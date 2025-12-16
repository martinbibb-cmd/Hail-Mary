/**
 * Depot Transcription Service
 * 
 * Handles AI-powered transcription processing including:
 * - Audio transcription via OpenAI Whisper
 * - Transcript-to-structured-notes conversion
 * - Section ordering and normalization
 * - Sanity checking logic
 * - Material extraction
 * - Missing information detection
 * 
 * Based on Depot Voice Notes worker logic
 */

import type {
  DepotNotes,
  DepotSection,
  DepotSectionSchema,
  MaterialItem,
  MissingInfoItem,
  StructuredTranscriptResult,
  ChecklistConfig,
  AIProviderConfig,
} from '@hail-mary/shared';
import { loadJsonConfigCached } from '../utils/configLoader';

// ============================================
// Schema and Configuration - Embedded Fallbacks
// ============================================

/**
 * Default depot schema fallback
 * Used if depot-schema.json cannot be loaded from any path
 */
const DEFAULT_DEPOT_SCHEMA: DepotSectionSchema = {
  sections: [
    {
      key: "customer_summary",
      name: "Customer Summary",
      description: "Brief overview of customer needs and key points from the conversation",
      order: 1,
      required: true
    },
    {
      key: "existing_system",
      name: "Existing System",
      description: "Current heating system details including boiler type, age, and condition",
      order: 2,
      required: true
    },
    {
      key: "property_details",
      name: "Property Details",
      description: "Property type, size, construction details, and insulation",
      order: 3,
      required: true
    },
    {
      key: "radiators_emitters",
      name: "Radiators & Emitters",
      description: "Details of existing radiators, underfloor heating, and heat emitters",
      order: 4,
      required: false
    },
    {
      key: "pipework",
      name: "Pipework",
      description: "Pipe sizes, materials, routing, and condition",
      order: 5,
      required: true
    },
    {
      key: "flue_ventilation",
      name: "Flue & Ventilation",
      description: "Flue type, routing, ventilation requirements",
      order: 6,
      required: true
    },
    {
      key: "hot_water",
      name: "Hot Water",
      description: "Hot water cylinder details, capacity, and configuration",
      order: 7,
      required: false
    },
    {
      key: "controls",
      name: "Controls",
      description: "Current controls, thermostats, and smart heating systems",
      order: 8,
      required: false
    },
    {
      key: "electrical",
      name: "Electrical",
      description: "Electrical supply, consumer unit, earth bonding, and capacity",
      order: 9,
      required: true
    },
    {
      key: "gas_supply",
      name: "Gas Supply",
      description: "Gas meter location, pipe size, and supply details",
      order: 10,
      required: false
    },
    {
      key: "water_supply",
      name: "Water Supply",
      description: "Mains water pressure, supply pipe, and stop cock details",
      order: 11,
      required: false
    },
    {
      key: "location_access",
      name: "Location & Access",
      description: "Proposed boiler location, access for installation, and constraints",
      order: 12,
      required: true
    },
    {
      key: "materials_parts",
      name: "Materials & Parts",
      description: "List of materials, parts, and components required for the job",
      order: 13,
      required: false
    },
    {
      key: "hazards_risks",
      name: "Hazards & Risks",
      description: "Safety concerns, asbestos, accessibility issues, and risk assessments",
      order: 14,
      required: true
    },
    {
      key: "customer_requests",
      name: "Customer Requests",
      description: "Specific customer requirements, preferences, and special requests",
      order: 15,
      required: false
    },
    {
      key: "follow_up_actions",
      name: "Follow-up Actions",
      description: "Actions required before quoting or installing",
      order: 16,
      required: false
    }
  ]
};

/**
 * Default checklist config fallback
 * Used if checklist-config.json cannot be loaded from any path
 */
const DEFAULT_CHECKLIST_CONFIG: ChecklistConfig = {
  checklist_items: [
    {
      id: "boiler_replacement",
      label: "Boiler Replacement",
      category: "primary_work",
      associated_materials: ["boiler", "flue_kit", "condensate_pipe", "filling_loop"]
    },
    {
      id: "system_flush",
      label: "System Flush/Cleanse",
      category: "system_work",
      associated_materials: ["inhibitor", "cleaner", "filter"]
    },
    {
      id: "pipework_modification",
      label: "Pipework Modifications",
      category: "system_work",
      associated_materials: ["copper_pipe_15mm", "copper_pipe_22mm", "fittings", "isolation_valves"]
    },
    {
      id: "radiator_upgrade",
      label: "Radiator Upgrade/Addition",
      category: "emitters",
      associated_materials: ["radiator", "trv", "radiator_valves"]
    },
    {
      id: "cylinder_replacement",
      label: "Hot Water Cylinder Replacement",
      category: "hot_water",
      associated_materials: ["cylinder", "immersion_heater", "cylinder_thermostat", "tundish"]
    },
    {
      id: "controls_upgrade",
      label: "Controls Upgrade",
      category: "controls",
      associated_materials: ["programmer", "room_thermostat", "wireless_receiver"]
    },
    {
      id: "gas_work",
      label: "Gas Supply Work",
      category: "services",
      associated_materials: ["gas_pipe_22mm", "gas_pipe_28mm", "gas_isolation_valve", "regulator"]
    },
    {
      id: "electrical_work",
      label: "Electrical Work",
      category: "services",
      associated_materials: ["fused_spur", "cable", "earth_bonding"]
    },
    {
      id: "flue_modification",
      label: "Flue Modifications",
      category: "ventilation",
      associated_materials: ["flue_kit", "plume_kit", "flue_brackets"]
    },
    {
      id: "filter_installation",
      label: "Magnetic Filter Installation",
      category: "system_work",
      associated_materials: ["magnetic_filter"]
    }
  ],
  material_aliases: {
    boiler: ["combi", "system boiler", "regular boiler", "back boiler"],
    radiator: ["rad", "rads", "radiators"],
    trv: ["thermostatic valve", "TRV", "trv valve"],
    copper_pipe_15mm: ["15mm pipe", "half inch pipe"],
    copper_pipe_22mm: ["22mm pipe", "three quarter pipe"],
    microbore: ["8mm", "10mm", "micro bore"],
    inhibitor: ["fernox", "sentinel", "system inhibitor"],
    magnetic_filter: ["magnaclean", "filter", "system filter"]
  }
};

// Load configurations with resilient fallback behavior
const depotSchemaResult = loadJsonConfigCached('depot-schema.json', DEFAULT_DEPOT_SCHEMA);
const checklistConfigResult = loadJsonConfigCached('checklist-config.json', DEFAULT_CHECKLIST_CONFIG);

const DEPOT_SCHEMA: DepotSectionSchema = depotSchemaResult.config;
const CHECKLIST_CONFIG: ChecklistConfig = checklistConfigResult.config;

/**
 * Get config load status for health checks
 */
export function getConfigLoadStatus() {
  return {
    depotSchema: {
      loadedFrom: depotSchemaResult.loadedFrom,
      usedFallback: depotSchemaResult.usedFallback,
    },
    checklistConfig: {
      loadedFrom: checklistConfigResult.loadedFrom,
      usedFallback: checklistConfigResult.usedFallback,
    },
  };
}

/**
 * Default instructions for the AI model when structuring depot notes
 * These have been refined over months for the heating survey domain
 */
const DEFAULT_DEPOT_NOTES_INSTRUCTIONS = `You are an expert heating engineer assistant. Your job is to structure voice notes from a heating survey into organized depot notes.

Extract and organize information into the following sections:
1. Customer Summary - Brief overview of what the customer needs
2. Existing System - Current boiler/heating details
3. Property Details - Property type, size, construction
4. Radiators & Emitters - Existing radiators and heat emitters
5. Pipework - Pipe sizes, materials, routing (IMPORTANT: normalize pipe sizes correctly - see below)
6. Flue & Ventilation - Flue type and routing
7. Hot Water - Cylinder details if applicable
8. Controls - Current thermostats and controls
9. Electrical - Supply, consumer unit, bonding
10. Gas Supply - Meter location, pipe size
11. Water Supply - Mains pressure, supply pipe
12. Location & Access - Proposed locations and access
13. Materials & Parts - List materials/parts mentioned
14. Hazards & Risks - Safety concerns, asbestos, etc.
15. Customer Requests - Specific customer requirements
16. Follow-up Actions - Actions needed before quoting

CRITICAL RULES:
- Pipe sizes: Always use standard format (e.g., "15mm", "22mm", "28mm", not "15 mm" or "15")
- For microbore, specify size: "8mm microbore" or "10mm microbore"
- Common mistakes to fix:
  * "Monkey muck" often transcribed as "monkey mock" - correct this
  * "TRV" often transcribed as "TRB" or "tearaway" - correct this
  * Pipe sizes like "fifteen millimeter" should be "15mm"
- Be concise but include all important details
- If information is missing for required sections, note "Not discussed"
- Extract materials/parts into a separate list with quantities where mentioned`;

/**
 * Get depot schema with ordering information
 */
export function getDepotSchema(): DepotSectionSchema {
  return DEPOT_SCHEMA;
}

/**
 * Get checklist configuration
 */
export function getChecklistConfig(): ChecklistConfig {
  return CHECKLIST_CONFIG;
}

/**
 * Normalize a section key to canonical format
 */
export function normalizeSectionKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Resolve canonical section name from various inputs
 */
export function resolveCanonicalSectionName(input: string): string | null {
  const normalized = normalizeSectionKey(input);
  
  // Direct match
  const directMatch = DEPOT_SCHEMA.sections.find(s => s.key === normalized);
  if (directMatch) return directMatch.key;
  
  // Fuzzy matching for common variations
  const aliases: Record<string, string> = {
    'customer': 'customer_summary',
    'summary': 'customer_summary',
    'boiler': 'existing_system',
    'system': 'existing_system',
    'current_system': 'existing_system',
    'property': 'property_details',
    'house': 'property_details',
    'rads': 'radiators_emitters',
    'radiators': 'radiators_emitters',
    'pipes': 'pipework',
    'piping': 'pipework',
    'flue': 'flue_ventilation',
    'ventilation': 'flue_ventilation',
    'cylinder': 'hot_water',
    'hw': 'hot_water',
    'dhw': 'hot_water',
    'thermostat': 'controls',
    'heating_controls': 'controls',
    'electric': 'electrical',
    'electricity': 'electrical',
    'gas': 'gas_supply',
    'water': 'water_supply',
    'mains': 'water_supply',
    'location': 'location_access',
    'access': 'location_access',
    'materials': 'materials_parts',
    'parts': 'materials_parts',
    'hazards': 'hazards_risks',
    'risks': 'hazards_risks',
    'safety': 'hazards_risks',
    'requests': 'customer_requests',
    'requirements': 'customer_requests',
    'followup': 'follow_up_actions',
    'actions': 'follow_up_actions',
  };
  
  if (aliases[normalized]) {
    return aliases[normalized];
  }
  
  return null;
}

/**
 * Normalize sections from AI model output
 * Ensures sections follow correct order and format
 */
export function normalizeSectionsFromModel(rawSections: Record<string, string>): DepotNotes {
  const normalized: DepotNotes = {};
  
  // Map raw sections to canonical keys
  for (const [rawKey, value] of Object.entries(rawSections)) {
    if (!value || value.trim() === '') continue;
    
    const canonicalKey = resolveCanonicalSectionName(rawKey);
    if (canonicalKey) {
      normalized[canonicalKey] = value.trim();
    }
  }
  
  return normalized;
}

/**
 * Build schema information for AI prompt
 */
export function buildSchemaInfo(): string {
  const sections = DEPOT_SCHEMA.sections
    .sort((a, b) => a.order - b.order)
    .map(s => `${s.order}. ${s.name} (${s.key}): ${s.description}`)
    .join('\n');
  
  return sections;
}

// ============================================
// Transcription Sanity Check Configuration
// ============================================

const PIPE_SIZE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(\d+)\s*mm/gi, replacement: '$1mm' }, // "15 mm" -> "15mm"
  { pattern: /(\d+)\s*millimeter/gi, replacement: '$1mm' }, // "15 millimeter" -> "15mm"
  { pattern: /fifteen\s*mm/gi, replacement: '15mm' },
  { pattern: /twenty[- ]?two\s*mm/gi, replacement: '22mm' },
  { pattern: /twenty[- ]?eight\s*mm/gi, replacement: '28mm' },
];

const COMMON_ERROR_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /monkey\s+mock/gi, replacement: 'monkey muck' },
  { pattern: /TRB/g, replacement: 'TRV' },
  { pattern: /tear[- ]?away\s+valve/gi, replacement: 'TRV' },
  { pattern: /micro[- ]?bore/gi, replacement: 'microbore' },
];

/**
 * Apply transcription sanity checks
 * Normalizes pipe sizes and fixes common transcription errors
 */
export function applyTranscriptionSanityChecks(text: string): string {
  let result = text;
  
  // Apply pipe size replacements
  for (const { pattern, replacement } of PIPE_SIZE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  
  // Apply common error fixes
  for (const { pattern, replacement } of COMMON_ERROR_FIXES) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Extract materials from transcript
 */
export function extractMaterials(transcript: string, depotNotes: DepotNotes): MaterialItem[] {
  const materials: MaterialItem[] = [];
  const text = transcript.toLowerCase();
  
  // Check materials_parts section first
  if (depotNotes.materials_parts) {
    const lines = depotNotes.materials_parts.split('\n');
    for (const line of lines) {
      if (line.trim() && line.includes('-')) {
        const parts = line.split('-');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const quantityMatch = line.match(/(\d+)x?/);
          materials.push({
            name,
            quantity: quantityMatch ? parseInt(quantityMatch[1]) : undefined,
            notes: parts.slice(1).join('-').trim(),
          });
        }
      }
    }
  }
  
  // Look for common materials mentioned
  const materialKeywords = [
    { pattern: /boiler/i, name: 'boiler' },
    { pattern: /radiator/i, name: 'radiator' },
    { pattern: /cylinder/i, name: 'cylinder' },
    { pattern: /magnetic\s+filter/i, name: 'magnetic_filter' },
    { pattern: /inhibitor/i, name: 'inhibitor' },
    { pattern: /\d+mm\s+pipe/i, name: 'copper_pipe' },
  ];
  
  for (const { pattern, name } of materialKeywords) {
    const matches = transcript.match(new RegExp(pattern, 'gi'));
    if (matches && matches.length > 0) {
      const existing = materials.find(m => m.name.toLowerCase().includes(name));
      if (!existing) {
        materials.push({ name });
      }
    }
  }
  
  return materials;
}

/**
 * Detect missing information
 */
export function detectMissingInfo(depotNotes: DepotNotes): MissingInfoItem[] {
  const missing: MissingInfoItem[] = [];
  
  // Check required sections
  const requiredSections = DEPOT_SCHEMA.sections.filter(s => s.required);
  
  for (const section of requiredSections) {
    const content = depotNotes[section.key];
    if (!content || content.trim() === '' || content.toLowerCase().includes('not discussed')) {
      missing.push({
        section: section.name,
        question: `What are the ${section.name.toLowerCase()} details?`,
        priority: 'critical',
      });
    }
  }
  
  // Specific checks based on content
  if (depotNotes.existing_system && !depotNotes.existing_system.includes('age')) {
    missing.push({
      section: 'Existing System',
      question: 'What is the age of the current boiler?',
      priority: 'important',
    });
  }
  
  if (depotNotes.pipework && !depotNotes.pipework.match(/\d+mm/)) {
    missing.push({
      section: 'Pipework',
      question: 'What are the pipe sizes?',
      priority: 'critical',
    });
  }
  
  if (depotNotes.electrical && !depotNotes.electrical.toLowerCase().includes('bonding')) {
    missing.push({
      section: 'Electrical',
      question: 'Is earth bonding present and correct?',
      priority: 'critical',
    });
  }
  
  return missing;
}

/**
 * Sanitize checklist configuration
 */
export function sanitizeChecklistConfig(): ChecklistConfig {
  return CHECKLIST_CONFIG;
}

/**
 * Match transcript to checklist items
 */
export function matchChecklistItems(transcript: string, materials: MaterialItem[]): string[] {
  const checklist: string[] = [];
  const text = transcript.toLowerCase();
  
  for (const item of CHECKLIST_CONFIG.checklist_items) {
    let matched = false;
    
    // Check if label keywords are mentioned
    const labelKeywords = item.label.toLowerCase().split(' ');
    const majorKeywords = labelKeywords.filter(k => k.length > 3); // Skip short words
    if (majorKeywords.some(keyword => text.includes(keyword))) {
      matched = true;
    }
    
    // Check if any associated materials are mentioned
    if (!matched) {
      for (const material of item.associated_materials) {
        const aliases = CHECKLIST_CONFIG.material_aliases[material] || [material];
        
        for (const alias of aliases) {
          if (text.includes(alias.toLowerCase())) {
            matched = true;
            break;
          }
        }
        
        if (matched) break;
      }
    }
    
    // Also check against extracted materials
    if (!matched) {
      for (const material of materials) {
        if (item.associated_materials.some(m => material.name.toLowerCase().includes(m))) {
          matched = true;
          break;
        }
      }
    }
    
    if (matched && !checklist.includes(item.id)) {
      checklist.push(item.id);
    }
  }
  
  return checklist;
}

// ============================================
// Main Export
// ============================================

export const depotTranscriptionService = {
  getDepotSchema,
  getChecklistConfig,
  getConfigLoadStatus,
  normalizeSectionKey,
  resolveCanonicalSectionName,
  normalizeSectionsFromModel,
  buildSchemaInfo,
  applyTranscriptionSanityChecks,
  extractMaterials,
  detectMissingInfo,
  sanitizeChecklistConfig,
  matchChecklistItems,
  DEFAULT_DEPOT_NOTES_INSTRUCTIONS,
};

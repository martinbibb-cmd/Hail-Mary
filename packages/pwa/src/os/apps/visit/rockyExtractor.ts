/**
 * Rocky Extractor - Local/Deterministic Extraction Engine
 * 
 * This is a lightweight, client-side implementation of Rocky's extraction logic.
 * It runs pattern matching and keyword detection on transcripts to extract
 * structured facts without requiring an external Worker/LLM.
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 * This module contains NO LLM usage, NO tone, NO prose.
 */

import type { RockyResult } from '@hail-mary/shared';
import type { KeyDetails, ChecklistItem } from './components';

interface ExtractionContext {
  transcript: string;
  previousFacts: KeyDetails;
  previousChecklist: ChecklistItem[];
}

/**
 * Extract structured data from transcript using deterministic rules
 */
export function extractFromTranscript(context: ExtractionContext): RockyResult {
  const { transcript, previousFacts, previousChecklist } = context;
  const lowerTranscript = transcript.toLowerCase();
  
  const result: RockyResult = {
    facts: { ...previousFacts },
    checklistUpdates: [],
    flags: [],
    openQuestions: [],
    rawMatches: [],
  };

  // Property Type Detection
  if (!result.facts.propertyType) {
    if (/\b(house|detached|semi-detached|terraced)\b/i.test(lowerTranscript)) {
      result.facts.propertyType = 'house';
      result.rawMatches?.push({ pattern: 'propertyType', match: 'house', confidence: 0.9 });
    } else if (/\b(flat|apartment)\b/i.test(lowerTranscript)) {
      result.facts.propertyType = 'flat';
      result.rawMatches?.push({ pattern: 'propertyType', match: 'flat', confidence: 0.9 });
    } else if (/\bbungalow\b/i.test(lowerTranscript)) {
      result.facts.propertyType = 'bungalow';
      result.rawMatches?.push({ pattern: 'propertyType', match: 'bungalow', confidence: 0.9 });
    }
  }

  // Bedroom Count Detection
  if (!result.facts.bedrooms) {
    const bedroomMatch = lowerTranscript.match(/(\d+)\s*(bed|bedroom)/);
    if (bedroomMatch) {
      result.facts.bedrooms = parseInt(bedroomMatch[1]);
      result.rawMatches?.push({ pattern: 'bedrooms', match: bedroomMatch[0], confidence: 0.85 });
    }
  }

  // Current System Detection
  if (!result.facts.currentSystem) {
    if (/\bcombi\s*(boiler)?\b/i.test(lowerTranscript)) {
      result.facts.currentSystem = 'Combi boiler';
      result.rawMatches?.push({ pattern: 'currentSystem', match: 'combi', confidence: 0.9 });
    } else if (/\bsystem\s*boiler\b/i.test(lowerTranscript)) {
      result.facts.currentSystem = 'System boiler';
      result.rawMatches?.push({ pattern: 'currentSystem', match: 'system boiler', confidence: 0.9 });
    } else if (/\bregular\s*boiler\b/i.test(lowerTranscript)) {
      result.facts.currentSystem = 'Regular boiler';
      result.rawMatches?.push({ pattern: 'currentSystem', match: 'regular boiler', confidence: 0.9 });
    }
  }

  // Boiler Age Detection
  if (!result.facts.boilerAge) {
    const ageMatch = lowerTranscript.match(/(\d+)\s*year[s]?\s*(old|aged)/);
    if (ageMatch) {
      result.facts.boilerAge = parseInt(ageMatch[1]);
      result.rawMatches?.push({ pattern: 'boilerAge', match: ageMatch[0], confidence: 0.8 });
    }
  }

  // Occupancy Detection
  if (!result.facts.occupancy) {
    if (/\bfamily\b/i.test(lowerTranscript)) {
      const childrenMatch = lowerTranscript.match(/(\d+)\s*child(ren)?/);
      if (childrenMatch) {
        const childCount = parseInt(childrenMatch[1]);
        result.facts.occupancy = `Family with ${childCount} child${childCount > 1 ? 'ren' : ''}`;
      } else {
        result.facts.occupancy = 'Family';
      }
      result.rawMatches?.push({ pattern: 'occupancy', match: 'family', confidence: 0.7 });
    } else if (/\b(couple|two people)\b/i.test(lowerTranscript)) {
      result.facts.occupancy = 'Couple';
      result.rawMatches?.push({ pattern: 'occupancy', match: 'couple', confidence: 0.8 });
    } else if (/\b(single|alone|one person)\b/i.test(lowerTranscript)) {
      result.facts.occupancy = 'Single occupancy';
      result.rawMatches?.push({ pattern: 'occupancy', match: 'single', confidence: 0.7 });
    }
  }

  // Issues Detection
  const issueKeywords = ['leak', 'noise', 'fault', 'broken', 'problem', 'issue', 'not working', 'cold'];
  const detectedIssues: string[] = [];
  
  for (const keyword of issueKeywords) {
    const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
    const matches = transcript.match(regex);
    if (matches) {
      detectedIssues.push(...matches);
      result.rawMatches?.push({ pattern: 'issues', match: keyword, confidence: 0.6 });
    }
  }
  
  if (detectedIssues.length > 0) {
    result.facts.issues = [...new Set([...(result.facts.issues || []), ...detectedIssues])];
  }

  // Checklist Detection
  const checklistPatterns = [
    { id: 'boiler_replacement', keywords: ['new boiler', 'replace boiler', 'boiler replacement', 'install boiler'] },
    { id: 'system_flush', keywords: ['flush', 'cleanse', 'clean system', 'power flush'] },
    { id: 'pipework_modification', keywords: ['pipework', 'new pipes', 'pipe modification', 'reroute'] },
    { id: 'radiator_upgrade', keywords: ['radiator', 'rad', 'new radiator', 'replace radiator'] },
    { id: 'cylinder_replacement', keywords: ['cylinder', 'hot water tank', 'replace cylinder'] },
    { id: 'controls_upgrade', keywords: ['thermostat', 'controls', 'programmer', 'smart controls'] },
    { id: 'gas_work', keywords: ['gas', 'gas pipe', 'gas supply'] },
    { id: 'electrical_work', keywords: ['electrical', 'wiring', 'fused spur', 'electric'] },
    { id: 'flue_modification', keywords: ['flue', 'flue work', 'flue modification'] },
    { id: 'filter_installation', keywords: ['filter', 'magnetic filter', 'magnaclean'] },
  ];

  for (const pattern of checklistPatterns) {
    const alreadyChecked = previousChecklist.find(item => item.id === pattern.id && item.checked);
    if (alreadyChecked) continue;

    for (const keyword of pattern.keywords) {
      if (lowerTranscript.includes(keyword)) {
        result.checklistUpdates.push({
          id: pattern.id,
          checked: true,
          note: `Detected from: "${keyword}"`,
        });
        result.rawMatches?.push({ pattern: 'checklist', match: keyword, confidence: 0.75 });
        break;
      }
    }
  }

  // Generate flags/warnings
  if (result.facts.boilerAge && result.facts.boilerAge > 15) {
    result.flags.push({
      type: 'warning',
      message: `Boiler is ${result.facts.boilerAge} years old - likely needs replacement`,
      timestamp: new Date(),
    });
  }

  if (result.facts.issues && result.facts.issues.length > 3) {
    result.flags.push({
      type: 'warning',
      message: `Multiple issues detected (${result.facts.issues.length}) - comprehensive survey recommended`,
      timestamp: new Date(),
    });
  }

  // Generate open questions based on missing data
  if (!result.facts.propertyType) {
    result.openQuestions.push('What type of property is this?');
  }
  if (!result.facts.currentSystem) {
    result.openQuestions.push('What type of heating system is currently installed?');
  }
  if (!result.facts.bedrooms) {
    result.openQuestions.push('How many bedrooms does the property have?');
  }

  return result;
}

/**
 * Get Rocky status based on local extraction capability
 * Since this is a local engine, status is always 'connected' unless there's a config issue
 */
export function getRockyStatus(): 'connected' | 'degraded' | 'blocked' {
  // Local extraction always works - no Worker dependency
  return 'connected';
}

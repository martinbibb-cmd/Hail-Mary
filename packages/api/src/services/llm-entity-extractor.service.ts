/**
 * LLM Entity Extractor Service
 *
 * Uses Gemini to extract structured entities and events from voice transcripts.
 *
 * Architecture:
 * - LLM interprets the transcript
 * - Extracts entities (boilers, controls, components, codes, measurements)
 * - Extracts events (diagnostics, faults, actions)
 * - Returns confidence scores
 * - Rocky validates and makes final decisions
 *
 * Key Principle: LLM is an interpreter, NOT the authority.
 */

import type {
  Entity,
  Event,
  BoilerEntity,
  ControlSystemEntity,
  ComponentEntity,
  FaultCodeEntity,
  MeasurementEntity,
  MaterialEntity,
  DiagnosticObservationEvent,
  FaultReportedEvent,
  MeasurementTakenEvent,
  ActionTakenEvent,
  ControlLogicEvent,
  ExtractionMetadata,
  ConfidenceLevel,
} from '@hail-mary/shared/atlas-voice';

import {
  BOILER_MAKE_ALIASES,
  COMMON_BOILER_MODELS,
  CONTROL_SYSTEMS,
  COMPONENT_ALIASES,
  DIAGNOSTIC_PATTERNS,
  FAULT_CODES,
  getConfidenceLevel,
  needsConfirmation,
} from '@hail-mary/shared/atlas-voice';

// ============================================
// Types
// ============================================

export interface EntityExtractionRequest {
  /** Raw transcript text */
  text: string;

  /** Session context */
  context?: {
    /** Survey type (helps with context) */
    surveyType?: string;

    /** Previously extracted entities in this session */
    previousEntities?: Entity[];

    /** Known products from GC catalog */
    knownProducts?: any[];
  };

  /** AI provider config */
  aiConfig?: {
    provider: 'gemini' | 'openai' | 'anthropic';
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface EntityExtractionResult {
  /** Extracted entities */
  entities: Entity[];

  /** Extracted events */
  events: Event[];

  /** Overall extraction confidence */
  overall_confidence: number;

  /** Number of items needing confirmation */
  items_needing_confirmation: number;

  /** Processing time in milliseconds */
  processing_time_ms: number;

  /** Warnings from extraction */
  warnings?: string[];
}

// ============================================
// Entity Extraction Prompt
// ============================================

/**
 * Build the system prompt for entity extraction
 */
function buildSystemPrompt(): string {
  return `You are an expert heating engineer analyzing voice notes from a site survey.

Your job is to extract **structured entities and events** from the transcript.

# CRITICAL RULES

1. **Extract ONLY what is explicitly mentioned** in the transcript
2. **DO NOT infer or assume** information not stated
3. **DO NOT add technical recommendations** - only extract facts
4. **Mark confidence honestly** - if uncertain, mark confidence lower
5. **Use provided catalogs** to normalize names and codes

# Entity Types

## 1. Boiler Entities
Extract: make, model, type (combi/system/regular), age, condition, output, fuel type

Example transcript: "Worcester 30i combi, about 8 years old, working fine"
Extract:
{
  "type": "boiler",
  "make": "Worcester Bosch",
  "model": "Greenstar 30i",
  "boiler_type": "combi",
  "age": 8,
  "condition": "working",
  "metadata": {
    "raw_text": "Worcester 30i combi, about 8 years old, working fine",
    "confidence": 0.92,
    "extraction_method": "exact_match"
  }
}

## 2. Control System Entities
Extract: system type (S-Plan, Y-Plan, etc.), components, wiring notes

Example transcript: "S-Plan system with zone valves"
Extract:
{
  "type": "control_system",
  "system_type": "s_plan",
  "name": "S-Plan",
  "components": ["zone_valve"],
  "metadata": {
    "raw_text": "S-Plan system with zone valves",
    "confidence": 0.95,
    "extraction_method": "exact_match"
  }
}

## 3. Component Entities
Extract: component type, name, location, state, make, model

Example transcript: "PRV is passing slightly"
Extract:
{
  "type": "component",
  "component_type": "prv",
  "name": "Pressure Relief Valve",
  "state": "discharging",
  "metadata": {
    "raw_text": "PRV is passing slightly",
    "confidence": 0.85,
    "extraction_method": "fuzzy_match"
  }
}

## 4. Fault Code Entities
Extract: code, description, associated boiler, severity

Example transcript: "Showing S16 fault code"
Extract:
{
  "type": "fault_code",
  "code": "S16",
  "description": "Low water pressure",
  "severity": "warning",
  "metadata": {
    "raw_text": "Showing S16 fault code",
    "confidence": 0.98,
    "extraction_method": "exact_match"
  }
}

## 5. Measurement Entities
Extract: measurement type, value, unit, location, expected range

Example transcript: "System pressure is 0.8 bar"
Extract:
{
  "type": "measurement",
  "measurement_type": "pressure",
  "value": 0.8,
  "unit": "bar",
  "context": "system pressure",
  "expected_range": {"min": 1.0, "max": 1.5, "unit": "bar"},
  "is_normal": false,
  "metadata": {
    "raw_text": "System pressure is 0.8 bar",
    "confidence": 0.95,
    "extraction_method": "exact_match"
  }
}

## 6. Material Entities
Extract: name, category, quantity, specification

Example transcript: "Need two 22mm zone valves"
Extract:
{
  "type": "material",
  "name": "zone valve",
  "category": "valve",
  "quantity": 2,
  "specification": "22mm",
  "metadata": {
    "raw_text": "Need two 22mm zone valves",
    "confidence": 0.90,
    "extraction_method": "llm_extracted"
  }
}

# Event Types

## 1. Diagnostic Observation Events
Extract: observation, severity, components, possible causes, checks

Example transcript: "PRV passing, might be overpressure"
Extract:
{
  "type": "diagnostic_observation",
  "observation": "PRV discharging",
  "severity": "moderate",
  "components_involved": ["pressure_relief_valve"],
  "requires_immediate_action": false,
  "metadata": {
    "raw_text": "PRV passing, might be overpressure",
    "confidence": 0.85,
    "extraction_method": "llm_extracted"
  }
}

## 2. Fault Reported Events
Extract: description, category, severity, customer impact

## 3. Measurement Taken Events
Extract: what was measured, value, unit, is it normal

## 4. Action Taken Events
Extract: action, reason, outcome

## 5. Control Logic Events
Extract: observation, expected vs actual behavior, components to check

# Confidence Scoring

Score 0.0 to 1.0 based on:
- **0.95-1.0 (very_high)**: Exact catalog match, explicit in transcript
- **0.85-0.94 (high)**: Clear statement, minor interpretation
- **0.70-0.84 (medium)**: Some interpretation needed
- **0.50-0.69 (low)**: Significant interpretation or ambiguity
- **0.0-0.49 (very_low)**: Highly uncertain or inferred

# Extraction Methods

- **exact_match**: Direct catalog match (e.g., "S16" → fault code catalog)
- **fuzzy_match**: Alias/close match (e.g., "backsy" → "Baxi")
- **inferred**: Derived from context (e.g., "zone valve" implies S-Plan)
- **llm_extracted**: Interpretation required

# Output Format

Return ONLY valid JSON:
{
  "entities": [...entity objects],
  "events": [...event objects]
}

Do NOT include any explanation or commentary outside the JSON.`;
}

/**
 * Build the user prompt with context
 */
function buildUserPrompt(
  transcript: string,
  context?: EntityExtractionRequest['context']
): string {
  let prompt = `# Transcript to Analyze

${transcript}

---

# Reference Catalogs

## Known Boiler Makes
${Object.entries(BOILER_MAKE_ALIASES)
  .slice(0, 20)
  .map(([alias, normalized]) => `- "${alias}" → "${normalized}"`)
  .join('\n')}

## Common Boiler Models
${Object.entries(COMMON_BOILER_MODELS)
  .slice(0, 10)
  .map(([id, model]: [string, any]) => `- ${model.make} ${model.model} (${model.type}, ${model.output_kw}kW)`)
  .join('\n')}

## Control Systems
${Object.entries(CONTROL_SYSTEMS)
  .map(([id, sys]: [string, any]) => `- ${sys.name}: ${sys.description}`)
  .join('\n')}

## Component Aliases
${Object.entries(COMPONENT_ALIASES)
  .slice(0, 15)
  .map(([alias, normalized]: [string, string]) => `- "${alias}" → "${normalized}"`)
  .join('\n')}

## Known Fault Codes
${Object.entries(FAULT_CODES)
  .slice(0, 10)
  .map(([id, code]: [string, any]) => `- ${code.code} (${code.make}): ${code.description}`)
  .join('\n')}

---

`;

  if (context?.previousEntities && context.previousEntities.length > 0) {
    prompt += `# Previously Extracted Entities in This Session

`;
    context.previousEntities.forEach(entity => {
      if (entity.type === 'boiler') {
        const boiler = entity as BoilerEntity;
        prompt += `- Boiler: ${boiler.make} ${boiler.model || ''}\n`;
      } else if (entity.type === 'control_system') {
        const control = entity as ControlSystemEntity;
        prompt += `- Control: ${control.name}\n`;
      }
    });
    prompt += '\n';
  }

  prompt += `# Your Task

Extract all entities and events from the transcript above.

Return the result as JSON in this exact format:
{
  "entities": [
    {
      "type": "boiler" | "control_system" | "component" | "fault_code" | "measurement" | "material",
      ... entity-specific fields,
      "metadata": {
        "raw_text": "exact quote from transcript",
        "confidence": 0.0-1.0,
        "confidence_level": "very_low" | "low" | "medium" | "high" | "very_high",
        "needs_confirmation": true | false,
        "extraction_method": "exact_match" | "fuzzy_match" | "inferred" | "llm_extracted",
        "extracted_at": "${new Date().toISOString()}",
        "alternatives": [] // optional, if ambiguous
      }
    }
  ],
  "events": [
    {
      "type": "diagnostic_observation" | "fault_reported" | "measurement_taken" | "action_taken" | "control_logic",
      ... event-specific fields,
      "metadata": { ... same structure as entities }
    }
  ]
}

IMPORTANT:
- Include ONLY entities/events explicitly mentioned
- Be conservative with confidence scores
- Mark anything uncertain as needs_confirmation: true
- Use the catalogs to normalize names (e.g., "backsy" → "Baxi")
- Return ONLY the JSON, no other text`;

  return prompt;
}

// ============================================
// Gemini API Integration
// ============================================

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiCandidate {
  content: {
    parts: Array<{ text?: string }>;
    role: string;
  };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Call Gemini for entity extraction
 */
async function callGeminiForEntityExtraction(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string = 'gemini-1.5-flash',
  temperature: number = 0.2,
  maxTokens: number = 4000
): Promise<{ entities: any[]; events: any[] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{ text: userPrompt }],
    },
  ];

  const body = {
    contents,
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: HTTP ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No candidates in Gemini response');
  }

  const candidate = data.candidates[0];
  const parts = candidate.content.parts;

  if (!parts || parts.length === 0 || !parts[0].text) {
    throw new Error('No text content in Gemini response');
  }

  const content = parts[0].text;

  try {
    const parsed = JSON.parse(content);
    return {
      entities: parsed.entities || [],
      events: parsed.events || [],
    };
  } catch (parseError) {
    throw new Error(`Failed to parse Gemini response: ${parseError}\n\nContent: ${content}`);
  }
}

// ============================================
// Entity Post-Processing
// ============================================

/**
 * Post-process entities to ensure proper typing and metadata
 */
function postProcessEntities(rawEntities: any[]): Entity[] {
  return rawEntities.map(entity => {
    // Ensure metadata exists and has required fields
    const metadata: ExtractionMetadata = {
      raw_text: entity.metadata?.raw_text || '',
      confidence: entity.metadata?.confidence || 0.5,
      confidence_level: entity.metadata?.confidence_level || getConfidenceLevel(entity.metadata?.confidence || 0.5),
      needs_confirmation: entity.metadata?.needs_confirmation ?? needsConfirmation(
        entity.metadata?.confidence || 0.5,
        entity.metadata?.extraction_method || 'llm_extracted'
      ),
      extraction_method: entity.metadata?.extraction_method || 'llm_extracted',
      extracted_at: entity.metadata?.extracted_at ? new Date(entity.metadata.extracted_at) : new Date(),
      alternatives: entity.metadata?.alternatives,
      notes: entity.metadata?.notes,
    };

    // Ensure confidence_level matches confidence score
    metadata.confidence_level = getConfidenceLevel(metadata.confidence);

    // Ensure needs_confirmation is set correctly
    metadata.needs_confirmation = needsConfirmation(metadata.confidence, metadata.extraction_method);

    return {
      ...entity,
      metadata,
    } as Entity;
  });
}

/**
 * Post-process events to ensure proper typing and metadata
 */
function postProcessEvents(rawEvents: any[]): Event[] {
  return rawEvents.map(event => {
    // Ensure metadata exists and has required fields
    const metadata: ExtractionMetadata = {
      raw_text: event.metadata?.raw_text || '',
      confidence: event.metadata?.confidence || 0.5,
      confidence_level: event.metadata?.confidence_level || getConfidenceLevel(event.metadata?.confidence || 0.5),
      needs_confirmation: event.metadata?.needs_confirmation ?? needsConfirmation(
        event.metadata?.confidence || 0.5,
        event.metadata?.extraction_method || 'llm_extracted'
      ),
      extraction_method: event.metadata?.extraction_method || 'llm_extracted',
      extracted_at: event.metadata?.extracted_at ? new Date(event.metadata.extracted_at) : new Date(),
      alternatives: event.metadata?.alternatives,
      notes: event.metadata?.notes,
    };

    // Ensure confidence_level matches confidence score
    metadata.confidence_level = getConfidenceLevel(metadata.confidence);

    // Ensure needs_confirmation is set correctly
    metadata.needs_confirmation = needsConfirmation(metadata.confidence, metadata.extraction_method);

    return {
      ...event,
      metadata,
    } as Event;
  });
}

/**
 * Calculate overall confidence and stats
 */
function calculateExtractionStats(entities: Entity[], events: Event[]): {
  overall_confidence: number;
  items_needing_confirmation: number;
} {
  const allItems = [...entities, ...events];

  if (allItems.length === 0) {
    return {
      overall_confidence: 0,
      items_needing_confirmation: 0,
    };
  }

  const totalConfidence = allItems.reduce((sum, item) => sum + item.metadata.confidence, 0);
  const overall_confidence = Math.round((totalConfidence / allItems.length) * 100) / 100;

  const items_needing_confirmation = allItems.filter(item => item.metadata.needs_confirmation).length;

  return {
    overall_confidence,
    items_needing_confirmation,
  };
}

// ============================================
// Main Extraction Function
// ============================================

/**
 * Extract entities and events from a transcript using LLM
 *
 * This is the main entry point for entity extraction.
 */
export async function extractEntitiesWithLLM(
  request: EntityExtractionRequest
): Promise<EntityExtractionResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Validate input
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Transcript text is required');
    }

    // Default AI config (use Gemini)
    const aiConfig = request.aiConfig || {
      provider: 'gemini' as const,
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-1.5-flash',
      temperature: 0.2,
      maxTokens: 4000,
    };

    if (!aiConfig.apiKey) {
      throw new Error('AI provider API key is required');
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(request.text, request.context);

    // Call LLM
    let rawResult: { entities: any[]; events: any[] };

    if (aiConfig.provider === 'gemini') {
      rawResult = await callGeminiForEntityExtraction(
        systemPrompt,
        userPrompt,
        aiConfig.apiKey,
        aiConfig.model,
        aiConfig.temperature,
        aiConfig.maxTokens
      );
    } else {
      throw new Error(`Provider ${aiConfig.provider} not yet implemented for entity extraction`);
    }

    // Post-process entities and events
    const entities = postProcessEntities(rawResult.entities);
    const events = postProcessEvents(rawResult.events);

    // Calculate stats
    const stats = calculateExtractionStats(entities, events);

    // Add warnings
    if (entities.length === 0 && events.length === 0) {
      warnings.push('No entities or events extracted from transcript');
    }

    if (stats.overall_confidence < 0.7) {
      warnings.push('Overall extraction confidence is low - many items need confirmation');
    }

    const processing_time_ms = Date.now() - startTime;

    return {
      entities,
      events,
      overall_confidence: stats.overall_confidence,
      items_needing_confirmation: stats.items_needing_confirmation,
      processing_time_ms,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    const processing_time_ms = Date.now() - startTime;
    throw new Error(`Entity extraction failed: ${(error as Error).message}`);
  }
}

// ============================================
// Export
// ============================================

export const llmEntityExtractorService = {
  extractEntitiesWithLLM,
  buildSystemPrompt,
  buildUserPrompt,
};

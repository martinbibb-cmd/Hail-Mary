# Atlas Voice - Entities & Events

**Status:** Architecture & Schema Defined ✅ | Implementation: Pending

---

## What This Is

This module contains the **foundational architecture** for Atlas Voice v2 — an engineer-grade voice system that understands heating engineering domain knowledge.

### The Core Insight (from Gemini)

Traditional dictation:
```
"PRV passing" → text: "PRV passing"
```

Atlas Voice (correct):
```
"PRV passing" → event: {
  type: "diagnostic_observation",
  component: "pressure_relief_valve",
  state: "discharging",
  severity: "medium",
  requires_action: true,
  suggested_checks: [...]
}
```

---

## What's in This Module

### 1. `entities-events-schema.ts`

**The Data Model**

Defines all entity and event types:

**Entities (Things):**
- `BoilerEntity` - Makes, models, types, conditions
- `ControlSystemEntity` - S-Plan, Y-Plan, wiring systems
- `ComponentEntity` - PRVs, stats, valves, cylinders
- `FaultCodeEntity` - EA, S16, E133, etc.
- `MeasurementEntity` - Pressures, temperatures, sizes
- `MaterialEntity` - Parts needed

**Events (Observations & Actions):**
- `DiagnosticObservationEvent` - "PRV passing", "stat calling"
- `FaultReportedEvent` - Customer-reported issues
- `MeasurementTakenEvent` - Readings taken on site
- `ActionTakenEvent` - What the engineer did
- `ControlLogicEvent` - Control system behavior mismatches

**Confidence Scoring:**
- Every extraction has a `confidence` (0.0 - 1.0)
- Confidence levels: `very_low` → `very_high`
- `needs_confirmation` flag for low-confidence items
- `extraction_method`: exact_match, fuzzy_match, llm_extracted, etc.

**Example:**
```typescript
const extraction: EntityEventExtraction = {
  id: "abc-123",
  session_id: 456,
  extracted_at: new Date(),
  raw_transcript: "Worcester 30i combi, S16 code, PRV passing",
  entities: [
    {
      type: "boiler",
      make: "Worcester Bosch",
      model: "Greenstar 30i",
      boiler_type: "combi",
      metadata: {
        raw_text: "Worcester 30i combi",
        confidence: 0.95,
        confidence_level: "very_high",
        needs_confirmation: false,
        extraction_method: "exact_match",
        extracted_at: new Date()
      }
    },
    {
      type: "fault_code",
      code: "S16",
      description: "Low water pressure",
      severity: "warning",
      metadata: {
        raw_text: "S16 code",
        confidence: 0.98,
        confidence_level: "very_high",
        needs_confirmation: false,
        extraction_method: "exact_match",
        extracted_at: new Date()
      }
    },
    {
      type: "component",
      component_type: "prv",
      name: "Pressure Relief Valve",
      state: "discharging",
      metadata: {
        raw_text: "PRV passing",
        confidence: 0.85,
        confidence_level: "high",
        needs_confirmation: true,
        extraction_method: "fuzzy_match",
        extracted_at: new Date()
      }
    }
  ],
  events: [
    {
      type: "diagnostic_observation",
      observation: "PRV discharging",
      severity: "moderate",
      components_involved: ["pressure_relief_valve"],
      suggested_checks: [
        "Check system pressure (should be 1-1.5 bar)",
        "Test expansion vessel charge",
        "Inspect PRV for debris"
      ],
      requires_immediate_action: false,
      metadata: {
        raw_text: "PRV passing",
        confidence: 0.85,
        confidence_level: "high",
        needs_confirmation: true,
        extraction_method: "llm_extracted",
        extracted_at: new Date()
      }
    }
  ],
  overall_confidence: 0.93,
  items_needing_confirmation: 2
};
```

---

### 2. `domain-knowledge-catalog.ts`

**The Engineering Knowledge**

This is the "enrichment loop" — the domain expertise that makes Atlas smarter than generic transcription.

**Boiler Knowledge:**
```typescript
BOILER_MAKE_ALIASES
// "backsy" → "Baxi"
// "wurster" → "Worcester Bosch"

COMMON_BOILER_MODELS
// Worcester Greenstar 30i → type: combi, output: 30kW, codes: EA, S16, D5

BOILER_MODEL_PATTERNS
// "thirty eye" → "Greenstar 30i"
```

**Control Systems:**
```typescript
CONTROL_SYSTEMS
// 's_plan' → definition, components, wiring notes, common issues, checks

CONTROL_SYSTEM_PATTERNS
// "zone valve" → likely S-Plan
// "three port valve" → Y-Plan
```

**Diagnostics:**
```typescript
DIAGNOSTIC_PATTERNS
// 'prv_passing' → causes, checks, severity, SOP reference

DIAGNOSTIC_TEXT_PATTERNS
// /prv\s*(passing|discharging)/ → 'prv_passing'
// /stat\s*calling.*no\s*heat/ → 'stat_calling_no_heat'
```

**Fault Codes:**
```typescript
FAULT_CODES
// 'worcester_s16' → description, causes, checks
// 'baxi_e133' → Gas valve fault, ...
```

**Jargon Normalization:**
```typescript
JARGON_NORMALIZATION
// "monkey mock" → "monkey muck" (asbestos lagging)
// "TRB" → "TRV" (common STT error)
// "tear away valve" → "TRV"
```

---

## How This Fits Into Atlas

### Current State (v1)
✅ **Voice Recording** - Browser + Whisper
✅ **Rocky v1** - Simple regex extraction
✅ **Sarah** - Template-based explanations
✅ **Voice Notes CRUD** - Full processing pipeline

### Next Step (v2) - **USE THIS MODULE**

**Rocky v2 Enhancement:**

1. **LLM Entity Extraction**
   - Input: Raw transcript + context (survey type, known products)
   - LLM extracts entities using `entities-events-schema.ts` types
   - Output: Structured entities with confidence scores

2. **Deterministic Validation** (Rocky remains the authority)
   - Validate entities against `domain-knowledge-catalog.ts`
   - Boost confidence for exact catalog matches
   - Flag ambiguous items for confirmation
   - Apply jargon normalization

3. **Event Generation**
   - Match diagnostic patterns
   - Generate suggested checks
   - Link to SOPs

4. **Output**
   - Same RockyFacts structure as v1
   - PLUS new `entities` and `events` fields
   - Confidence scores for UI confirmation

---

## Implementation Roadmap

### Phase 1: LLM Entity Extractor Service (2-3 days)
```typescript
// packages/api/src/services/llm-entity-extractor.service.ts

export async function extractEntitiesWithLLM(request: {
  text: string;
  context: {
    surveyType?: string;
    knownProducts: any[];
    knownControls: any;
    sessionEntities?: Entity[];
  };
}): Promise<{
  entities: Entity[];
  events: Event[];
  confidence: number;
}> {
  // Call Gemini/Claude with structured prompt
  // Include domain knowledge as context
  // Parse response into Entity/Event types
  // Return with confidence scores
}
```

### Phase 2: Entity Validator (1-2 days)
```typescript
// packages/api/src/services/entity-validator.service.ts

export function validateEntitiesAgainstCatalog(
  entities: Entity[],
  catalogs: {
    products: typeof COMMON_BOILER_MODELS;
    controls: typeof CONTROL_SYSTEMS;
    diagnostics: typeof DIAGNOSTIC_PATTERNS;
  }
): Entity[] {
  // For each entity:
  //   - Check against catalog
  //   - Boost confidence if exact match
  //   - Flag if no match (low confidence)
  //   - Suggest alternatives
  // Return validated entities
}
```

### Phase 3: Enhanced Rocky Service (2-3 days)
```typescript
// packages/api/src/services/rocky.service.ts (v2)

export async function processNaturalNotes(
  request: RockyProcessRequest
): Promise<RockyProcessResult> {
  // 1. Normalize text (deterministic)
  const normalized = normalizeText(request.naturalNotes);

  // 2. LLM extraction (NEW)
  const llmResult = await extractEntitiesWithLLM({...});

  // 3. Validate (deterministic - Rocky decides)
  const validated = validateEntitiesAgainstCatalog(llmResult.entities, {...});

  // 4. Score confidence
  const scored = scoreEntityConfidence(validated);

  // 5. Generate RockyFacts (same as v1, but from entities)
  const rockyFacts = buildRockyFactsFromEntities(scored);

  // 6. Return v1 output PLUS new entities/events
  return {
    rockyFacts,        // v1 format
    entities: scored,  // NEW
    events: llmResult.events,  // NEW
    ...
  };
}
```

### Phase 4: Confirmation UI (3-4 days)
React components for engineer review:
- Entity chips with confidence indicators
- Tap to confirm/edit low-confidence items
- Alternative suggestions dropdown

### Phase 5: Testing & Refinement (ongoing)
- Real survey transcripts
- Accuracy metrics
- Engineer feedback loop
- Catalog expansion

---

## Next Steps for You

### Option 1: Build LLM Entity Extractor
If you want to start implementing v2, this is the first piece.

**What you need:**
- Write the LLM prompt (use schema types as context)
- Call Gemini/Claude API
- Parse JSON response into Entity/Event types
- Handle errors gracefully

### Option 2: Expand Domain Catalog
The catalog is a starter set. You can expand:
- More boiler models (eventually integrate full GC catalog)
- More fault codes
- More diagnostic patterns
- SOP references

### Option 3: Build Confirmation UI
Design the engineer review experience:
- Show extracted entities
- Highlight low-confidence items
- Allow quick edits
- Persist confirmations

---

## Key Design Principles (ADHD-Optimized)

1. **Never punish verbosity**
   - Speak everything, sort later
   - Messy input → clean output

2. **Defer to clarity**
   - Low confidence? Flag for confirmation.
   - Never hallucinate certainty.

3. **Trust beats intelligence**
   - Engineers forgive missed terms
   - Engineers won't forgive wrong certainty
   - Show confidence scores always

4. **Session-scoped, not always-on**
   - Engineer controls when to record
   - No ambient listening
   - Privacy by design

---

## Questions?

Read the full architecture document:
- `/docs/ATLAS_VOICE_ARCHITECTURE.md`

This module is ready to use. The implementation work is:
1. LLM entity extractor service
2. Entity validator service
3. Rocky v2 integration
4. Confirmation UI components

Let me know which piece you want to tackle first!

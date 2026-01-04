# Atlas Voice Architecture
## Engineer-Grade Voice System for Heating Engineers

**Document Version:** 1.0
**Last Updated:** 2025-12-31
**Status:** Implementation Roadmap

---

## Executive Summary

This document defines Atlas Voice's evolution from basic transcription to an **engineer-grade voice assistant** that understands heating engineering domain knowledge.

**Core Principle:**
```
Dictation → Domain-specific event capture
```

Atlas Voice is NOT:
- A general-purpose transcription tool (like Otter)
- An always-on ambient listener (like Alexa)
- AI magic that guesses what you meant

Atlas Voice IS:
- A **session-scoped** voice capture system
- A **domain-aware** entity + event extractor
- A **confidence-scored** fact processor with engineer control

---

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│  THE EAR                                                │
│  - Browser speech recognition (real-time)               │
│  - Whisper recording (server-processed)                 │
│  - Session-based (not always-on)                        │
│  - Wake-lock for tablets                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  THE INTERPRETER (LLM Layer)                            │
│  - Gemini/Claude for entity extraction                  │
│  - Input: raw transcript + survey context + products    │
│  - Output: entities + events + confidence               │
│  - DOES NOT make final decisions                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  ROCKY (Logic Layer) ⭐ THE CROWN JEWEL                  │
│  - Deterministic engineering rules                      │
│  - Entity validation against product catalog            │
│  - Event interpretation (PRV passing, stat calling)     │
│  - Confidence scoring                                   │
│  - MAKES ALL FINAL DECISIONS                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  SARAH (Explanation Layer)                              │
│  - Audience-specific formatting                         │
│  - Customer-safe notes                                  │
│  - Engineer notes                                       │
│  - Does NOT add new technical claims                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  THE ENRICHMENT LOOP                                    │
│  - Alias tables: "backsy" → "Baxi"                      │
│  - Product lookup: "S16" → Worcester Greenstar 30i      │
│  - Control recognition: "S-Plan", "Y-Plan"              │
│  - Vectors later (when scale demands it)                │
└─────────────────────────────────────────────────────────┘
```

---

## The Critical Insight: Entities + Events

### What Gemini Got Right

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
  requires_action: true
}
```

### Why This Matters

Engineers don't just speak words — they describe:
- **Entities:** Boilers, cylinders, stats, valves, controls
- **Events:** Faults, diagnostics, observations, measurements
- **Relationships:** "Cylinder stat is calling but no heat" = control logic mismatch

---

## Implementation Roadmap

### 🔹 Atlas Voice v1 — "Dumping Ground" (Current → 2 weeks)

**Goal:** Capture everything without slowing engineers down.

**Features:**
- ✅ Already implemented: Voice recording service
- ✅ Already implemented: Rocky v1 (regex extraction)
- ✅ Already implemented: Sarah explanations
- ✅ Already implemented: Session-based processing

**Current Gaps:**
- Rocky is too simple (regex-only)
- No domain knowledge
- No confidence scoring
- No confirmation UI

**User Experience:**
```
Engineer hits big mic button
→ Speaks freely (no structure required)
→ Session ends
→ Output split into:
  - Client-safe notes
  - Engineer notes
  - Parts list
```

**Success Metric:** Engineers trust it enough to use it every survey.

---

### 🔹 Atlas Voice v2 — "Engineer-Aware" (4-6 weeks)

**Goal:** Understand heating engineering domain.

**New Features:**

#### 1. Enhanced Rocky with Entity Extraction
```typescript
// Input
"Worcester 30i combi, S16 code, PRV passing"

// Output
{
  entities: [
    {
      type: "boiler",
      make: "Worcester Bosch",
      model: "Greenstar 30i",
      category: "combi",
      confidence: 0.95,
      needs_confirmation: false
    },
    {
      type: "fault_code",
      code: "S16",
      description: "Low water pressure",
      boiler_compatible: true,
      confidence: 0.98,
      needs_confirmation: false
    },
    {
      type: "component",
      name: "pressure_relief_valve",
      state: "discharging",
      confidence: 0.85,
      needs_confirmation: true
    }
  ],
  events: [
    {
      type: "diagnostic_observation",
      description: "PRV discharging",
      severity: "medium",
      suggested_checks: [
        "Check system pressure (should be 1-1.5 bar)",
        "Inspect PRV for debris",
        "Check expansion vessel charge"
      ]
    }
  ],
  confidence: 0.93,
  raw_text: "Worcester 30i combi, S16 code, PRV passing"
}
```

#### 2. Domain Knowledge Catalog

**Product Entities:**
```typescript
// packages/shared/src/atlas-voice/entities/products.ts
export const BOILER_CATALOG = {
  aliases: {
    "worcester": "Worcester Bosch",
    "baxi": "Baxi",
    "backsy": "Baxi",
    "vaillant": "Vaillant",
    "ideal": "Ideal"
  },
  models: {
    "worcester_greenstar_30i": {
      make: "Worcester Bosch",
      model: "Greenstar 30i",
      type: "combi",
      output_kw: 30,
      common_codes: ["S16", "EA", "D5"]
    }
    // ... more models
  }
}
```

**Control Entities:**
```typescript
export const CONTROL_SYSTEMS = {
  "s_plan": {
    name: "S-Plan",
    type: "heating_only_plus_hw",
    components: ["zone_valves", "hw_cylinder", "cylinder_stat"],
    wiring_diagram: "s_plan_wiring.svg"
  },
  "y_plan": {
    name: "Y-Plan",
    type: "heating_and_hw_shared",
    components: ["3_port_valve", "hw_cylinder", "cylinder_stat"],
    wiring_diagram: "y_plan_wiring.svg"
  }
}
```

**Diagnostic Entities:**
```typescript
export const DIAGNOSTIC_EVENTS = {
  "prv_passing": {
    component: "pressure_relief_valve",
    state: "discharging",
    common_causes: [
      "Overpressure",
      "Debris in valve seat",
      "Expansion vessel failure"
    ],
    checks: [
      "System pressure (should be 1-1.5 bar)",
      "Expansion vessel charge",
      "PRV condition"
    ]
  },
  "stat_calling_no_heat": {
    event: "control_mismatch",
    components: ["thermostat", "zone_valve", "cylinder_stat"],
    checks: [
      "Thermostat wiring (terminals 1-3)",
      "Zone valve motor operation",
      "Boiler demand light",
      "Wiring centre connections"
    ]
  }
}
```

#### 3. Confidence Scoring

```typescript
// packages/shared/src/rocky/types.ts (enhanced)
export interface EntityExtraction {
  entity: Entity;
  confidence: number; // 0.0 - 1.0
  needs_confirmation: boolean; // true if < 0.9
  alternative_matches?: Entity[]; // if ambiguous
  extraction_method: 'exact_match' | 'fuzzy_match' | 'inferred' | 'llm_extracted';
}
```

#### 4. Confirmation UI

```tsx
// UI pattern (not implemented yet, design only)
<ConfirmationChips>
  <Chip status="confirmed" icon="✔️">
    Boiler: Worcester 30i
  </Chip>
  <Chip status="needs_confirmation" icon="❓" onClick={handleEdit}>
    Fault: PRV passing
    <Alternatives>
      • PRV discharging
      • PRV weeping
      • Safety valve open
    </Alternatives>
  </Chip>
  <Chip status="confirmed" icon="✔️">
    Control: S-Plan
  </Chip>
</ConfirmationChips>
```

**Success Metric:** 90%+ entity extraction accuracy with engineer trust.

---

### 🔹 Atlas Voice v3 — "Logic-Driven Assistant" (8-12 weeks)

**Goal:** Provide SOP-driven suggestions and become a "silent second engineer."

**New Features:**

#### 1. SOP-Driven Suggestions

```typescript
// Based on extracted entities + events, suggest next steps
{
  observations: [
    { type: "stat_calling", component: "cylinder_stat" },
    { type: "no_heat", location: "cylinder" }
  ],
  suggestions: [
    {
      check: "2-port valve motor operation",
      reason: "Stat calling but no heat indicates valve issue",
      priority: "high",
      sop_reference: "SOP-HW-001"
    },
    {
      check: "Terminal 4 live at wiring centre",
      reason: "Verify HW demand signal",
      priority: "high",
      sop_reference: "SOP-HW-002"
    },
    {
      check: "HW off satisfied check",
      reason: "Confirm stat isn't stuck open",
      priority: "medium",
      sop_reference: "SOP-STAT-003"
    }
  ]
}
```

#### 2. Conditional Prompts

```
"You've mentioned cylinder calling with no heat — want me to add
a 2-port valve check to the job notes?"

[Yes] [No] [Remind me later]
```

#### 3. Wiring Logic Integration

- Recognize control systems (S-Plan, Y-Plan, etc.)
- Suggest terminal checks based on fault description
- Reference wiring diagrams from GC catalog

**Success Metric:** Engineers use suggestions 60%+ of the time.

---

## Technical Implementation Details

### Rocky v2 Enhanced Architecture

```typescript
// packages/api/src/services/rocky.service.ts (enhanced)

/**
 * Process natural notes through Rocky v2
 * NOW uses LLM for entity extraction + deterministic rules for validation
 */
export async function processNaturalNotes(
  request: RockyProcessRequest
): Promise<RockyProcessResult> {

  // Step 1: Normalize text (deterministic)
  const normalizedText = normalizeText(request.naturalNotes);

  // Step 2: LLM entity extraction (NEW)
  const llmExtraction = await extractEntitiesWithLLM({
    text: normalizedText,
    context: {
      surveyType: request.surveyType,
      knownProducts: await getProductCatalog(),
      knownControls: CONTROL_SYSTEMS,
      previousEntities: request.sessionEntities // from earlier in session
    }
  });

  // Step 3: Validate against deterministic rules (AUTHORITY)
  const validatedEntities = validateEntitiesAgainstCatalog(
    llmExtraction.entities,
    { products: PRODUCT_CATALOG, controls: CONTROL_SYSTEMS }
  );

  // Step 4: Calculate confidence scores
  const scoredEntities = scoreEntityConfidence(validatedEntities);

  // Step 5: Generate facts (same as v1, but from entities)
  const rockyFacts = buildRockyFactsFromEntities(scoredEntities);

  // Step 6: Generate automatic notes and engineer basics
  const automaticNotes = generateAutomaticNotes(sessionId, rockyFacts);
  const engineerBasics = generateEngineerBasics(sessionId, rockyFacts);

  return {
    success: true,
    rockyFacts,
    entities: scoredEntities, // NEW in v2
    automaticNotes,
    engineerBasics,
    processingTimeMs: Date.now() - startTime
  };
}
```

### LLM Entity Extraction Prompt

```typescript
// packages/api/src/services/llm-entity-extractor.service.ts

const ENTITY_EXTRACTION_PROMPT = `You are an expert heating engineer analyzing voice notes from a site survey.

Your job is to extract structured entities and events from the transcript.

# Available Entity Types:

1. **Boilers**
   - Make, Model, Type (combi/system/regular), Age, Condition

2. **Controls**
   - System type (S-Plan, Y-Plan, etc.)
   - Programmers, Thermostats, Stats

3. **Components**
   - Cylinders, Valves, Pumps, PRVs, Expansion vessels

4. **Measurements**
   - Pipe sizes, Pressures, Temperatures, Flow rates

5. **Fault Codes**
   - Code number, Description, Boiler compatibility

6. **Diagnostic Events**
   - Observations (PRV passing, stat calling, no heat, etc.)
   - Symptoms, States, Conditions

# Known Products (for reference):
${JSON.stringify(productContext, null, 2)}

# Known Control Systems:
${JSON.stringify(controlContext, null, 2)}

# Transcript:
${transcript}

# Your Task:
Extract entities and events in this JSON format:
{
  "entities": [
    {
      "type": "boiler" | "control" | "component" | "measurement" | "fault_code",
      "raw_text": "exact phrase from transcript",
      "normalized": {
        // structured data matching entity type
      },
      "confidence": 0.0-1.0,
      "needs_confirmation": boolean,
      "alternative_matches": [] // if ambiguous
    }
  ],
  "events": [
    {
      "type": "diagnostic_observation" | "measurement" | "fault_reported",
      "description": "what was observed",
      "severity": "low" | "medium" | "high",
      "components_involved": [],
      "suggested_actions": []
    }
  ]
}

# Important:
- Be conservative with confidence scores
- Flag ambiguous terms for engineer confirmation
- Don't hallucinate entities not in the transcript
- Use aliases (e.g., "backsy" → "Baxi") but mark as fuzzy match
`;
```

---

## Data Schema Evolution

### Rocky Facts v2 Schema

```typescript
// packages/shared/src/rocky/types.ts (v2)

export interface RockyFactsV2 extends RockyFactsV1 {
  version: '2.0.0';

  // NEW: Extracted entities with confidence
  entities: {
    boilers: Array<{
      make: string;
      model?: string;
      type?: 'combi' | 'system' | 'regular';
      age?: number;
      condition?: 'working' | 'faulty' | 'condemned';
      confidence: number;
      needs_confirmation: boolean;
      raw_text: string;
      gc_product_id?: number; // link to GC catalog
    }>;

    controls: Array<{
      system_type: string; // S-Plan, Y-Plan, etc.
      components: string[];
      confidence: number;
      needs_confirmation: boolean;
      raw_text: string;
    }>;

    components: Array<{
      type: string; // cylinder, valve, pump, etc.
      location?: string;
      state?: string;
      confidence: number;
      needs_confirmation: boolean;
      raw_text: string;
    }>;

    fault_codes: Array<{
      code: string;
      description?: string;
      boiler?: string;
      confidence: number;
      needs_confirmation: boolean;
      raw_text: string;
    }>;

    measurements: Array<{
      type: string;
      value: number;
      unit: string;
      confidence: number;
      raw_text: string;
    }>;
  };

  // NEW: Diagnostic events
  events: Array<{
    type: 'diagnostic_observation' | 'fault_reported' | 'measurement_taken';
    description: string;
    severity: 'low' | 'medium' | 'high';
    components_involved: string[];
    suggested_actions?: string[];
    timestamp: Date;
    confidence: number;
  }>;

  // Existing v1 fields remain for backward compatibility
  facts: RockyFactsV1['facts'];
  completeness: RockyFactsV1['completeness'];
  missingData: RockyFactsV1['missingData'];
}

export type RockyFacts = RockyFactsV1 | RockyFactsV2;
```

---

## UI/UX Patterns

### Session Flow

```
┌─────────────────────────────────────────────────────┐
│  Survey Screen                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  🎤 Recording... (01:23)                      │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Live Transcript Preview:                          │
│  ┌───────────────────────────────────────────────┐ │
│  │ "Worcester 30i combi, showing S16 fault code, │ │
│  │  PRV is passing slightly..."                  │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Extracted Entities (auto-updating):               │
│  ┌───────────────────────────────────────────────┐ │
│  │ ✔️ Boiler: Worcester Greenstar 30i            │ │
│  │ ✔️ Fault: S16 (Low water pressure)            │ │
│  │ ❓ Component: PRV discharging  [Tap to edit]  │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [ Stop Recording ]                                │
└─────────────────────────────────────────────────────┘
```

### Confirmation Pattern

```
┌─────────────────────────────────────────────────────┐
│  Review Extracted Information                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Boiler: Worcester Greenstar 30i              ✔│ │
│  │ Confidence: 95%                                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Component: PRV discharging                   ❓│ │
│  │ Confidence: 78%                                │ │
│  │                                                │ │
│  │ Did you mean:                                  │ │
│  │ • PRV discharging           [Select]          │ │
│  │ • PRV weeping               [Select]          │ │
│  │ • Safety valve open         [Select]          │ │
│  │ • Other (type to specify)   [Select]          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [ Confirm All ] [ Review Again ]                  │
└─────────────────────────────────────────────────────┘
```

---

## ADHD-Optimized Workflow

### Design Principles

1. **Never punish verbosity**
   - Speak everything, sort later
   - Messy input → clean output
   - Never lose ideas

2. **Minimize friction**
   - One big mic button
   - Auto-save always
   - Resume mid-session

3. **Defer to clarity**
   - Prefer typed summaries later
   - Track confidence, not certainty
   - Allow edits without penalty

4. **Trust beats intelligence**
   - Engineers forgive missed terms
   - Engineers won't forgive hallucinated certainty
   - Show confidence scores always

---

## Success Metrics by Version

### v1 Success Metrics
- ✅ Engineers use it every survey
- ✅ Session completion rate > 80%
- ✅ Zero lost recordings

### v2 Success Metrics
- Entity extraction accuracy > 90%
- Confirmation rate < 20% (most auto-confirmed)
- Engineer trust score > 4.5/5

### v3 Success Metrics
- Suggestion acceptance rate > 60%
- Time saved per survey > 5 minutes
- "Would recommend" score > 90%

---

## Security & Privacy

### Data Handling

1. **Voice recordings:**
   - Stored encrypted in Supabase
   - Auto-delete after 90 days (configurable)
   - Engineer can delete anytime

2. **Transcripts:**
   - PII flagged and redacted in customer-safe notes
   - Engineer notes kept separate
   - Audit trail always maintained

3. **LLM processing:**
   - Zero-retention agreements with providers
   - No training on customer data
   - Self-hosted Whisper option for paranoid clients

---

## Next Steps

### Immediate (This Session)
1. ✅ Create this architecture document
2. ⏳ Design Entity + Event JSON schema
3. ⏳ Create engineering domain knowledge catalog
4. ⏳ Implement Rocky v2 with LLM entity extraction
5. ⏳ Add confidence scoring

### Short-term (Next 2-4 weeks)
- Build confirmation UI components
- Integrate GC product catalog lookup
- Add control system recognition
- Create diagnostic event patterns

### Medium-term (4-8 weeks)
- Implement SOP-driven suggestions
- Add wiring logic integration
- Build conditional prompts system
- Create feedback loop for improving extraction

### Long-term (8-12 weeks)
- Vector-based product matching
- Multi-session context awareness
- Predictive fault analysis
- Integration with job scheduling

---

## Appendix A: Gemini Analysis Alignment

### What Gemini Got Right ✅

1. **Entities + Events** — Core insight
2. **Domain-specific extraction** — Not general transcription
3. **LLM as interpreter, not authority** — Rocky decides
4. **Enrichment loop** — Aliases, product lookup
5. **ADHD-friendly** — Speak everything, sort later

### What Needs Tightening ⚠️

1. **"Always-on"** — Should be session-scoped, not ambient
2. **LLM role** — Clarified: interpreter, not decision-maker
3. **Trust model** — Confidence scoring + engineer control

---

## Appendix B: Why This Beats Competitors

### vs. Otter / General Transcription
- Otter: "PRV passing" → text
- Atlas: "PRV passing" → diagnostic event with checks

### vs. Industry-Specific Tools
- Competitors: Form-filling with voice
- Atlas: Free-form capture with intelligent extraction

### vs. AI Assistants (ChatGPT, etc.)
- ChatGPT: General knowledge, no domain expertise
- Atlas: Heating engineering SOP knowledge embedded

---

**End of Architecture Document**

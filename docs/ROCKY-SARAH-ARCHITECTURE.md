# Rocky & Sarah Architecture

## Overview

Hail-Mary's voice notes system is built on a strict separation between **deterministic fact extraction** (Rocky) and **human-facing explanations** (Sarah).

### Architectural Rule

> **Rocky decides. Sarah explains.**

This principle ensures that:
- Facts are derived consistently and auditably
- Explanations are audience-appropriate without altering facts
- The system maintains a clear source of truth

## Components

### Rocky - Logic Engine

**Purpose**: Deterministic, auditable fact extraction and derivation

**Responsibilities**:
- Consume transcripts / natural notes (verbatim)
- Derive structured facts using deterministic rules (NO LLM)
- Output versioned RockyFacts JSON
- Generate Automatic Notes from facts
- Generate Engineer Basics (fixed format)

**Key Characteristics**:
- ❌ NO LLM usage
- ❌ NO tone or prose
- ❌ NO interpretation or recommendations
- ✅ Pure rule-based extraction
- ✅ Deterministic (same input = same output)
- ✅ Auditable and versioned

**Example**: Rocky extracts "15mm" from "fifteen millimeter pipes" using regex patterns, not AI interpretation.

### Sarah - Explanation Layer

**Purpose**: Audience-specific explanations from Rocky's facts

**Responsibilities**:
- Consume RockyFacts (readonly, no modification)
- Generate human-readable explanations
- Adapt tone and style for target audience
- Add context and clarity

**Key Characteristics**:
- ✅ MAY use LLM for tone and clarity
- ✅ Audience-aware (customer, engineer, surveyor, manager, admin)
- ✅ Tone-aware (professional, friendly, technical, simple, urgent)
- ❌ MUST NOT add new technical claims
- ❌ MUST NOT contradict Rocky's facts
- ❌ MUST NOT make recommendations

**Example**: Sarah explains "15mm pipes" as "Your system uses 15mm pipes" (customer) or "Pipe: 15mm" (engineer).

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Voice Notes System                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Natural Notes                              │
│  - Verbatim transcript (raw)                                   │
│  - User-editable                                                │
│  - Stored with SHA-256 hash for auditability                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Rocky Logic Engine                           │
│  - Deterministic extraction (NO LLM)                           │
│  - Rule-based normalization                                     │
│  - Fact derivation                                              │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      RockyFacts JSON        │   │    Automatic Notes          │
│  (Versioned Contract)       │   │  (Structured Output)        │
│                             │   │                             │
│  - Facts (measurements,     │   │  - Customer Summary         │
│    materials, hazards)      │   │  - Property Overview        │
│  - Completeness scores      │   │  - System Details           │
│  - Missing data             │   │  - Measurements             │
│  - Version: 1.0.0           │   │  - Materials Required       │
└─────────────────────────────┘   │  - Hazards Identified       │
                                   │  - Next Steps               │
                                   └─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Engineer Basics                                │
│  (Fixed Format, Copy-Only)                                     │
│                                                                  │
│  - Property Type: house                                         │
│  - Bedrooms: 3                                                  │
│  - Boiler Make/Model: Worcester 30CDi                          │
│  - Pipe Size: 15mm                                              │
│  - Main Fuse: 60A                                               │
│  - Materials: [boiler, radiator x3]                            │
│  - Hazards: [asbestos (high)]                                  │
│  - Actions: [verify bonding (critical)]                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               Sarah Explanation Layer                           │
│  (On-Demand, Audience-Specific)                                │
│                                                                  │
│  Input: RockyFacts (readonly)                                  │
│  Config: Audience + Tone                                        │
│  Output: Human-readable explanation                             │
│                                                                  │
│  Audiences:                                                     │
│  - Customer: Simple, friendly                                   │
│  - Engineer: Technical, precise                                 │
│  - Surveyor: Practical, action-focused                         │
│  - Manager: Overview, implications                              │
│  - Admin: Administrative aspects                                │
└─────────────────────────────────────────────────────────────────┘
```

## RockyFacts Contract (v1.0.0)

RockyFacts is a versioned JSON contract that serves as the single source of truth.

```typescript
interface RockyFactsV1 {
  version: '1.0.0';
  sessionId: number;
  processedAt: Date;
  naturalNotesHash: string; // SHA-256 for auditability
  
  facts: {
    customer?: { ... };      // Verbatim extraction
    property?: { ... };      // Factual observations
    existingSystem?: { ... }; // Direct measurements
    measurements?: { ... };   // Raw numbers
    materials?: [ ... ];      // Mentioned items
    hazards?: [ ... ];        // Observed risks
    requiredActions?: [ ... ]; // Derived from facts
  };
  
  completeness: {
    customerInfo: number;    // 0-100
    propertyDetails: number; // 0-100
    existingSystem: number;  // 0-100
    measurements: number;    // 0-100
    overall: number;         // 0-100
  };
  
  missingData: Array<{
    category: string;
    field: string;
    required: boolean;
  }>;
}
```

## API Endpoints

### Process Transcript

```http
POST /api/voice-notes/process
Content-Type: application/json

{
  "sessionId": 123
}
```

Response:
```json
{
  "success": true,
  "data": {
    "rockyFacts": { ... },
    "automaticNotes": { ... },
    "engineerBasics": { ... },
    "voiceNoteId": 456
  }
}
```

### Generate Explanation

```http
POST /api/voice-notes/456/explain
Content-Type: application/json

{
  "audience": "customer",
  "tone": "friendly"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "explanation": {
      "audience": "customer",
      "tone": "friendly",
      "sections": {
        "summary": "Here's what we found...",
        "systemAssessment": "...",
        "nextStepsGuidance": "..."
      },
      "disclaimer": "Based on survey facts..."
    },
    "explanationId": 789
  }
}
```

### Edit Natural Notes

```http
PATCH /api/voice-notes/456/edit
Content-Type: application/json

{
  "editedNotes": "Corrected transcript with fixed names..."
}
```

This triggers automatic re-processing through Rocky.

## Database Schema

### voice_notes

```sql
CREATE TABLE voice_notes (
  id SERIAL PRIMARY KEY,
  session_id INTEGER UNIQUE NOT NULL,
  
  -- Natural Notes (verbatim, editable)
  natural_notes_raw TEXT NOT NULL,
  natural_notes_edited TEXT,
  natural_notes_hash VARCHAR(64) NOT NULL,
  
  -- Rocky Outputs
  rocky_facts_version VARCHAR(20) NOT NULL,
  rocky_facts JSONB NOT NULL,
  automatic_notes JSONB NOT NULL,
  engineer_basics JSONB NOT NULL,
  
  -- Metadata
  rocky_processed_at TIMESTAMPTZ NOT NULL,
  rocky_processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### sarah_explanations

```sql
CREATE TABLE sarah_explanations (
  id SERIAL PRIMARY KEY,
  voice_note_id INTEGER NOT NULL,
  
  -- Request parameters
  audience VARCHAR(50) NOT NULL,
  tone VARCHAR(50) NOT NULL,
  
  -- Sarah output
  explanation JSONB NOT NULL,
  rocky_facts_version VARCHAR(20) NOT NULL,
  
  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage Examples

### Basic Workflow

```typescript
// 1. User records voice notes during survey
// 2. Transcript is generated and stored

// 3. Process through Rocky
const rockyResult = await fetch('/api/voice-notes/process', {
  method: 'POST',
  body: JSON.stringify({ sessionId: 123 })
});

const { voiceNoteId, rockyFacts, automaticNotes, engineerBasics } = rockyResult.data;

// 4. Generate customer-facing explanation
const customerExplanation = await fetch(`/api/voice-notes/${voiceNoteId}/explain`, {
  method: 'POST',
  body: JSON.stringify({ 
    audience: 'customer',
    tone: 'friendly'
  })
});

// 5. Generate engineer notes
const engineerExplanation = await fetch(`/api/voice-notes/${voiceNoteId}/explain`, {
  method: 'POST',
  body: JSON.stringify({ 
    audience: 'engineer',
    tone: 'technical'
  })
});
```

### Editing Natural Notes

```typescript
// User edits the transcript to fix names or details
const editResult = await fetch(`/api/voice-notes/${voiceNoteId}/edit`, {
  method: 'PATCH',
  body: JSON.stringify({
    editedNotes: 'Customer Smith (not Smythe)...'
  })
});

// Rocky automatically re-processes
// Sarah explanations remain valid (based on RockyFacts version)
```

## Design Decisions

### Why Separate Rocky and Sarah?

1. **Auditability**: Rocky's deterministic extraction creates a verifiable fact trail
2. **Consistency**: Same transcript always produces same facts
3. **Flexibility**: Multiple explanations from single fact set
4. **Testability**: Deterministic logic is easier to test
5. **Maintainability**: Clear separation of concerns

### Why NO LLM in Rocky?

- **Consistency**: LLMs are non-deterministic
- **Cost**: Rule-based extraction is cheaper
- **Speed**: No API calls for basic extraction
- **Auditability**: Rules are explicit and reviewable
- **Reliability**: No dependency on external AI services

### Why Allow LLM in Sarah?

- **Tone**: LLMs excel at audience-appropriate language
- **Clarity**: Better at explaining complex technical details
- **Context**: Can add helpful framing without changing facts
- **Flexibility**: Easy to adjust tone without changing logic

### Version Management

RockyFacts is versioned to support:
- **Evolution**: New fields can be added in v1.1.0, v2.0.0, etc.
- **Compatibility**: Old explanations work with new facts (forward compatible)
- **Migration**: Clear upgrade paths when schema changes
- **Audit Trail**: Know which version produced which facts

## Testing Strategy

### Rocky Tests (Deterministic)

```typescript
it('should extract pipe sizes deterministically', async () => {
  const result1 = await rockyService.processNaturalNotes({ ... });
  const result2 = await rockyService.processNaturalNotes({ ... });
  
  expect(result1.rockyFacts).toEqual(result2.rockyFacts);
});
```

### Sarah Tests (Consistency)

```typescript
it('should not add new technical claims', async () => {
  const result = await sarahService.explainRockyFacts({ ... });
  
  // Verify no prohibited phrases
  expect(result.explanation.sections).not.toContain('I recommend');
  expect(result.explanation.sections).not.toContain('you should');
});
```

## Future Enhancements

### Rocky v1.1.0 (Potential)

- Enhanced material quantity extraction
- Room-by-room fact organization
- Equipment condition scoring
- Compliance check rules

### Sarah Enhancements

- LLM integration for better explanations
- Multi-language support
- PDF/Word export formatting
- Email/SMS templates

### On-Device Rocky

Rocky's deterministic nature makes it ideal for edge deployment:
- Run on surveyor's tablet/phone
- No API calls needed
- Instant fact extraction
- Privacy-preserving

Sarah remains cloud-based for explanation quality.

## Maintenance

### Adding New Fact Types

1. Update `RockyFactsV1` interface (or create v2)
2. Add extraction rules to Rocky service
3. Update Automatic Notes generation
4. Update Engineer Basics if needed
5. Update Sarah explanations to reference new facts
6. Write tests

### Changing Extraction Rules

1. Document the rule change
2. Update Rocky service
3. Add tests for new behavior
4. Verify existing tests still pass
5. Consider version bump if breaking

### Adding New Audiences

1. Add audience to `SarahAudience` type
2. Add template to Sarah config
3. Implement explanation function
4. Write tests for new audience
5. Document usage

## Related Documentation

- [Voice Notes API](./VOICE-NOTES-API.md) (if created)
- [Depot Transcription (Legacy)](./DEPOT-TRANSCRIPTION.md) (if exists)
- [Survey Workflow](./SURVEY-WORKFLOW.md) (if exists)

## Questions & Answers

**Q: Can I use LLMs to extract facts?**  
A: No. Facts must be extracted deterministically. LLMs can be used in Sarah for explanation only.

**Q: What if Rocky extracts incorrect facts?**  
A: Edit Natural Notes and re-process. Rocky will deterministically re-extract. This maintains audit trail.

**Q: Can Sarah add information Rocky didn't extract?**  
A: No. Sarah explains what Rocky found. Sarah can add context ("typically this means...") but not new facts.

**Q: How do I migrate from old depot notes?**  
A: Create a migration script that processes old transcripts through Rocky. Rocky will extract facts, and Sarah can generate equivalent explanations.

**Q: What happens when RockyFacts schema changes?**  
A: Version number increases (v1.0.0 → v2.0.0). Old facts remain valid. Sarah can work with multiple versions.

## Future Enhancement: Worker Integration (LLM Sarah)

### Current State
Sarah uses **template-based generation** (no LLM). This provides consistent, fast explanations but lacks natural language flexibility.

### Future State: Cloudflare Worker Integration
When ready to add LLM capabilities, Sarah can call a Cloudflare Worker for natural language generation.

### Environment Variables (Pre-configured)

The infrastructure is **already configured** to support Worker integration:

```bash
# Cloudflare Worker URL (default provided)
SARAH_BASE_URL=https://hail-mary.martinbibb.workers.dev

# Worker endpoints
SARAH_VOICE_NOTES_PATH=/v1/voice-notes  # Voice notes processing
SARAH_CHAT_PATH=/v1/chat                # Chat interface
SARAH_TRANSCRIBE_PATH=/v1/transcribe    # Transcription service
```

Add these to your `.env` file when deploying the Worker.

### Migration Path

1. **Keep templates**: Current template-based Sarah continues to work
2. **Deploy Worker**: Set up Cloudflare Worker with `/v1/*` routes
3. **Update service**: Modify `sarah.service.ts` to call Worker endpoint
4. **A/B test**: Compare template vs LLM output quality
5. **Switch**: Enable LLM mode via feature flag

### Worker API Contract

**Request to Worker:**
```http
POST https://hail-mary.martinbibb.workers.dev/v1/voice-notes
Content-Type: application/json

{
  "rockyFacts": { /* RockyFactsV1 */ },
  "audience": "customer",
  "tone": "friendly"
}
```

**Response from Worker:**
```json
{
  "explanation": {
    "sections": {
      "summary": "Here's what we found during your survey...",
      "systemAssessment": "About your current system...",
      "nextStepsGuidance": "What happens next..."
    }
  },
  "model": "gpt-4o-mini",
  "tokensUsed": 450
}
```

### Worker Safety Rules

The Worker MUST:
- ✅ Consume RockyFacts as readonly context
- ✅ Generate explanations based ONLY on provided facts
- ✅ Apply audience-specific tone
- ✅ Include disclaimer: "Based on survey facts"

The Worker MUST NOT:
- ❌ Modify or add to RockyFacts
- ❌ Make claims not in RockyFacts
- ❌ Use prohibited phrases (see `SarahConfig.safetyRules`)

### Why Separate Worker?

**Benefits:**
- 🚀 **Independent scaling**: LLM calls don't block API
- 💰 **Cost control**: Track LLM usage separately
- 🔄 **Easy updates**: Change prompts without API deployment
- 🌍 **Edge deployment**: Low latency worldwide (Cloudflare)
- 🔒 **API key isolation**: Sensitive keys stay in Worker

---

**Last Updated**: 2024-12-17  
**Version**: 1.1.0  
**Architectural Rule**: Rocky decides. Sarah explains.

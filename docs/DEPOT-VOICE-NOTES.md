# Depot Voice Notes Transcription Service

This feature provides AI-powered transcription and structuring of heating survey voice notes into organized depot notes.

## Overview

The Depot Transcription Service extracts voice notes from heating engineers during site surveys and automatically structures them into standardized sections with:

- **Transcription**: OpenAI Whisper converts audio to text
- **Sanity Checks**: Automatically fixes common transcription errors (pipe sizes, technical terms)
- **AI Structuring**: GPT-4 or Claude organizes transcripts into 16 depot sections
- **Material Extraction**: Identifies parts and materials mentioned
- **Missing Info Detection**: Highlights critical information gaps
- **Checklist Generation**: Suggests work items based on content

## Features

### 1. Audio Transcription

Uses OpenAI Whisper API to transcribe audio chunks with high accuracy for technical heating terminology.

**Key capabilities:**
- Multi-language support (defaults to en-GB)
- Handles technical jargon (boiler models, pipe sizes, etc.)
- Progressive upload of audio chunks
- Background processing queue

### 2. Transcription Sanity Checks

Automatically corrects common transcription errors:

```typescript
// Examples of corrections:
"15 mm pipe" → "15mm pipe"
"monkey mock" → "monkey muck" (asbestos paste)
"TRB valve" → "TRV valve"
"micro-bore" → "microbore"
```

### 3. Structured Depot Notes

AI organizes free-form transcripts into 16 standardized sections:

1. **Customer Summary** - Brief overview of customer needs
2. **Existing System** - Current heating system details
3. **Property Details** - Property type, size, construction
4. **Radiators & Emitters** - Heat emitter details
5. **Pipework** - Pipe sizes, materials, routing
6. **Flue & Ventilation** - Flue type and configuration
7. **Hot Water** - Cylinder details
8. **Controls** - Thermostats and controls
9. **Electrical** - Supply, consumer unit, bonding
10. **Gas Supply** - Meter location, pipe size
11. **Water Supply** - Mains pressure, supply pipe
12. **Location & Access** - Proposed locations
13. **Materials & Parts** - Required materials list
14. **Hazards & Risks** - Safety concerns
15. **Customer Requests** - Specific requirements
16. **Follow-up Actions** - Pre-quote actions

### 4. Material Extraction

Automatically identifies materials and parts mentioned:

```typescript
{
  name: "Worcester Greenstar 30CDi",
  quantity: 1,
  notes: "Combi boiler replacement"
}
```

### 5. Missing Information Detection

Identifies critical gaps in survey data:

```typescript
{
  section: "Pipework",
  question: "What are the pipe sizes?",
  priority: "critical"
}
```

### 6. Checklist Generation

Suggests work items based on materials and requirements:

- Boiler Replacement
- System Flush/Cleanse
- Pipework Modifications
- Radiator Upgrade
- Controls Upgrade
- etc.

## API Endpoints

### Structure a Transcript into Depot Notes

```
POST /api/depot-notes/sessions/:sessionId/structure
```

Converts a completed transcript session into structured depot notes.

**Response:**
```json
{
  "success": true,
  "data": {
    "depotNotes": {
      "customer_summary": "Customer needs new combi boiler...",
      "existing_system": "Worcester Greenstar 24i Junior, 15 years old...",
      "pipework": "15mm copper throughout, 22mm feeds..."
    },
    "materials": [
      {
        "name": "boiler",
        "quantity": 1
      }
    ],
    "missingInfo": [
      {
        "section": "Electrical",
        "question": "Is earth bonding present?",
        "priority": "critical"
      }
    ],
    "checklist": ["boiler_replacement", "system_flush"],
    "confidence": 0.85
  }
}
```

### Get Depot Schema

```
GET /api/depot-notes/schema
```

Returns the depot section schema with ordering and descriptions.

### Get Checklist Configuration

```
GET /api/depot-notes/checklist-config
```

Returns checklist items and material aliases.

## Configuration

### Environment Variables

```bash
# OpenAI API key for Whisper and GPT-4
OPENAI_API_KEY=sk-...

# Anthropic API key for Claude (optional fallback)
ANTHROPIC_API_KEY=sk-ant-...

# Enable Whisper STT provider
USE_WHISPER_STT=true
```

### AI Provider Fallback

The service uses a primary + fallback pattern:

1. **Primary**: OpenAI GPT-4
2. **Fallback**: Anthropic Claude (if both API keys configured)

If the primary provider fails, it automatically retries with the fallback.

## Schema Configuration

Depot sections are defined in `packages/shared/src/core/depot-schema.json`:

```json
{
  "sections": [
    {
      "key": "customer_summary",
      "name": "Customer Summary",
      "description": "Brief overview of customer needs",
      "order": 1,
      "required": true
    }
  ]
}
```

Checklist items are defined in `packages/shared/src/core/checklist-config.json`:

```json
{
  "checklist_items": [
    {
      "id": "boiler_replacement",
      "label": "Boiler Replacement",
      "category": "primary_work",
      "associated_materials": ["boiler", "flue_kit"]
    }
  ]
}
```

## Usage Example

### 1. Create a Transcript Session

```typescript
POST /api/transcription/sessions
{
  "customerId": 123,
  "language": "en-GB"
}
```

### 2. Upload Audio Chunks

```typescript
POST /api/transcription/sessions/:sessionId/chunks
Content-Type: multipart/form-data

audio: [audio file]
index: 0
startOffsetSeconds: 0
durationSeconds: 30
```

### 3. Complete the Session

```typescript
POST /api/transcription/sessions/:sessionId/complete
```

### 4. Structure into Depot Notes

```typescript
POST /api/depot-notes/sessions/:sessionId/structure
```

## Testing

Run the test suite:

```bash
cd packages/api
npm test -- depotTranscription.service.test.ts
```

22 tests covering:
- Section key normalization
- Canonical name resolution
- Transcription sanity checks
- Material extraction
- Missing info detection
- Checklist matching

## Key Business Logic

The AI instructions (`DEFAULT_DEPOT_NOTES_INSTRUCTIONS`) contain months of refinement for the heating survey domain. Key rules:

- Always normalize pipe sizes (15mm, 22mm, 28mm)
- Fix common transcription errors
- Extract materials with quantities
- Identify safety hazards
- Note missing critical information

## Integration Points

### With Survey Helper

The depot notes can populate the Survey Helper's SystemSpecDraft for guided surveys.

### With Product Database

Reference materials from the product database can be injected into AI prompts for better part identification.

### With AI Assistant

The assistant can process voice notes and generate structured surveys on-the-fly.

## Future Enhancements

- [ ] Speaker diarization (distinguish engineer vs customer)
- [ ] Real-time streaming transcription
- [ ] Custom section templates
- [ ] Integration with quote generation
- [ ] Photo correlation with transcript sections
- [ ] Multi-variant quote detection

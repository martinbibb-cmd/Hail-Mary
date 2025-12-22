# Background Transcription & Auto-Population System

## Overview

This system enables continuous voice transcription that works **across all pages** in the application. Transcription continues even when you navigate away from the Visit page, and all collected data is automatically used to populate relevant fields in Property, Boiler, Quotation, and other modules.

## Key Features

✅ **Background Processing** - Transcription continues regardless of navigation
✅ **Auto-Population** - Extracted data automatically fills forms across all modules
✅ **Real-Time Updates** - All components receive updates as data is extracted
✅ **Visual Indicators** - Auto-populated fields are clearly marked
✅ **Confidence Scoring** - Quality indicators for extracted data
✅ **Offline Support** - Works offline with automatic sync when online

---

## Architecture

```
User speaks
    ↓
VoiceRecordingService (Global Singleton)
    ↓
BackgroundTranscriptionProcessor (Global Service)
    ├─ Transcript Correction
    ├─ Enhanced Data Extraction (AI-powered)
    │  ├─ Property Data
    │  ├─ Boiler Data
    │  ├─ Quotation Data
    │  └─ Occupancy Data
    ├─ Auto-Population of Modules
    │  ├─ Property Module
    │  ├─ Boiler/Quote Module
    │  ├─ Lead Store
    │  └─ Local Storage (metadata)
    └─ Save Trigger (with retry queue)
```

---

## Core Components

### 1. Background Transcription Processor

**File:** `packages/pwa/src/services/backgroundTranscriptionProcessor.ts`

The main service that orchestrates transcription processing:

```typescript
import { backgroundTranscriptionProcessor } from '@/services/backgroundTranscriptionProcessor';

// Start a session
backgroundTranscriptionProcessor.startSession(leadId, sessionId);

// Stop a session
backgroundTranscriptionProcessor.stopSession();

// Get extracted data
const data = backgroundTranscriptionProcessor.getExtractedData(leadId);
```

### 2. Transcription Store

**File:** `packages/pwa/src/stores/transcriptionStore.ts`

Global Zustand store for transcription state:

```typescript
import { useTranscriptionStore } from '@/stores/transcriptionStore';

function MyComponent() {
  const activeSession = useTranscriptionStore(state => state.getActiveSession());
  const segments = activeSession?.segments || [];

  return <div>Segments: {segments.length}</div>;
}
```

### 3. Enhanced Data Extractor

**File:** `packages/pwa/src/services/enhancedDataExtractor.ts`

AI-powered extraction service:

```typescript
import { extractStructuredData } from '@/services/enhancedDataExtractor';

const data = extractStructuredData(transcript);

console.log(data.property);     // Property details
console.log(data.boiler);        // Boiler specifications
console.log(data.quotation);     // Work required
console.log(data.occupancy);     // Usage patterns
console.log(data.confidence);    // 0-1 confidence score
```

---

## Usage Guide

### For Visit App (Already Integrated)

The VisitApp automatically starts/stops transcription sessions:

```typescript
// When starting a visit
backgroundTranscriptionProcessor.startSession(customerId, sessionId);

// When ending a visit
backgroundTranscriptionProcessor.stopSession();
```

### For Other Components

Use the `useExtractedData` hook to access auto-populated data:

#### Example: Property Module

```typescript
import { useExtractedData } from '@/hooks/useExtractedData';
import { AutoPopulatedBadge } from '@/components/AutoPopulatedBadge';

function PropertyModule({ leadId }: { leadId: string }) {
  const { property, confidence, isAvailable } = useExtractedData(leadId);

  return (
    <div>
      <label>
        Property Type:
        {isAvailable && property.propertyType && (
          <AutoPopulatedBadge confidence={confidence} />
        )}
      </label>
      <select value={property.propertyType || ''}>
        <option value="detached">Detached</option>
        <option value="semi">Semi-detached</option>
        <option value="terraced">Terraced</option>
        <option value="flat">Flat</option>
        <option value="bungalow">Bungalow</option>
      </select>

      <label>
        Bedrooms:
        {isAvailable && property.bedrooms && (
          <AutoPopulatedBadge confidence={confidence} />
        )}
      </label>
      <input type="number" value={property.bedrooms || ''} />
    </div>
  );
}
```

#### Example: Boiler/Quote Module

```typescript
import { useExtractedData } from '@/hooks/useExtractedData';
import { AutoPopulatedBadge } from '@/components/AutoPopulatedBadge';

function BoilerModule({ leadId }: { leadId: string }) {
  const { boiler, quotation, confidence, isAvailable } = useExtractedData(leadId);

  return (
    <div>
      <h3>Current System</h3>

      <label>
        Boiler Type:
        {isAvailable && boiler.currentBoilerType && (
          <AutoPopulatedBadge confidence={confidence} />
        )}
      </label>
      <input value={boiler.currentBoilerType || ''} readOnly />

      <label>
        Age:
        {isAvailable && boiler.boilerAge && (
          <AutoPopulatedBadge confidence={confidence} />
        )}
      </label>
      <input value={`${boiler.boilerAge || ''} years`} readOnly />

      <h3>Work Required</h3>
      {quotation.workRequired && quotation.workRequired.length > 0 && (
        <ul>
          {quotation.workRequired.map((item, i) => (
            <li key={i}>
              {item}
              <AutoPopulatedBadge compact confidence={confidence} />
            </li>
          ))}
        </ul>
      )}

      {quotation.estimatedCost && (
        <div>
          Estimated Cost: £{quotation.estimatedCost}
          <AutoPopulatedBadge confidence={confidence} />
        </div>
      )}
    </div>
  );
}
```

---

## Hooks API

### `useExtractedData(leadId)`

Main hook for accessing extracted data:

```typescript
const {
  property,      // Property data
  boiler,        // Boiler data
  quotation,     // Quotation data
  occupancy,     // Occupancy patterns
  issues,        // Detected issues
  notes,         // General notes
  confidence,    // 0-1 confidence score
  isAvailable,   // Whether data exists
  lastUpdated,   // ISO timestamp
  refresh,       // () => void - reload data
  clear,         // () => void - clear data
} = useExtractedData(leadId);
```

### `useIsFieldAutoPopulated(leadId, fieldName)`

Check if a specific field is auto-populated:

```typescript
const { isAutoPopulated, confidence, value } = useIsFieldAutoPopulated(
  leadId,
  'propertyType'
);

if (isAutoPopulated) {
  console.log('Field auto-populated with confidence:', confidence);
  console.log('Value:', value);
}
```

### `useAutoPopulatedFields(leadId)`

Get list of all auto-populated field names:

```typescript
const autoFields = useAutoPopulatedFields(leadId);
// => ['propertyType', 'bedrooms', 'boilerAge', ...]
```

---

## Components API

### `<AutoPopulatedBadge />`

Visual indicator for auto-populated fields:

```typescript
<AutoPopulatedBadge
  confidence={0.9}           // Optional: 0-1 score (default: 1)
  tooltip="Custom message"   // Optional: custom tooltip
  compact={false}            // Optional: compact mode
  className="custom-class"   // Optional: custom CSS class
/>
```

#### Visual Variants

- **High Confidence** (≥ 0.8): Green badge
- **Medium Confidence** (0.5 - 0.8): Orange badge
- **Low Confidence** (< 0.5): Pink badge

---

## Extracted Data Structure

### Property Data

```typescript
interface PropertyData {
  propertyType?: 'detached' | 'semi' | 'terraced' | 'flat' | 'bungalow';
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  ageBand?: string;
  construction?: {
    walls?: string;
    roof?: string;
    floors?: string;
    glazing?: string;
  };
  loftInsulation?: boolean;
  loftDepth?: number;
  address?: {
    street?: string;
    city?: string;
    postcode?: string;
  };
}
```

### Boiler Data

```typescript
interface BoilerData {
  currentBoilerType?: 'combi' | 'system' | 'regular' | 'back_boiler';
  currentBoilerMake?: string;
  currentBoilerModel?: string;
  boilerAge?: number;
  boilerLocation?: string;
  flueType?: string;
  gasSupply?: string;
  waterPressure?: string;
  recommendedBoilerType?: string;
  replacementRequired?: boolean;
  replacementUrgency?: 'immediate' | 'soon' | 'future';
}
```

### Quotation Data

```typescript
interface QuotationData {
  workRequired?: string[];
  boilerReplacementNeeded?: boolean;
  cylinderReplacementNeeded?: boolean;
  radiatorUpgradeNeeded?: boolean;
  controlsUpgradeNeeded?: boolean;
  systemFlushNeeded?: boolean;
  estimatedCost?: number;
  urgency?: 'emergency' | 'urgent' | 'routine';
}
```

### Occupancy Data

```typescript
interface OccupancyData {
  occupants?: number;
  schedule?: string;
  hotWaterUsage?: 'high' | 'medium' | 'low';
  heatingPatterns?: string;
  homeAllDay?: boolean;
  workFromHome?: boolean;
}
```

---

## Pattern Recognition

The extractor recognizes patterns like:

### Property Patterns

- "3 bed semi-detached" → `bedrooms: 3, propertyType: 'semi'`
- "Victorian terrace" → `propertyType: 'terraced', ageBand: 'pre-1919'`
- "double glazed windows" → `construction.glazing: 'double glazed'`
- "2 storey house" → `floors: 2`

### Boiler Patterns

- "15 year old combi boiler" → `boilerAge: 15, currentBoilerType: 'combi'`
- "Worcester Bosch" → `currentBoilerMake: 'Worcester'`
- "boiler in kitchen cupboard" → `boilerLocation: 'kitchen'`
- "needs urgent replacement" → `replacementRequired: true, replacementUrgency: 'immediate'`

### Quotation Patterns

- "boiler replacement and system flush" → `workRequired: ['Boiler Replacement', 'System Flush']`
- "around £3000" → `estimatedCost: 3000`
- "broken and not working" → `urgency: 'emergency'`

### Occupancy Patterns

- "4 people living here" → `occupants: 4`
- "work from home all day" → `workFromHome: true, homeAllDay: true`
- "lots of showers" → `hotWaterUsage: 'high'`

---

## Testing

### Test Background Transcription

1. Start a visit in VisitApp
2. Begin recording voice
3. Navigate to another page (e.g., Property module, Dashboard)
4. **Transcription continues in background**
5. Return to VisitApp - see all segments captured
6. Check Property module - see auto-populated fields

### Test Auto-Population

1. Start recording: "This is a 3 bedroom semi-detached house with a 15 year old Worcester combi boiler that needs replacing urgently"
2. Stop recording
3. Navigate to Property module
4. **Verify**: Property type = "semi", Bedrooms = 3
5. Navigate to Boiler module
6. **Verify**: Boiler type = "combi", Age = 15, Make = "Worcester"
7. **Verify**: Replacement required = true, Urgency = "immediate"

### Test Real-Time Updates

1. Open VisitApp and Property module in side-by-side windows
2. Start recording in VisitApp
3. Say: "4 bedroom house"
4. **Verify**: Property module updates automatically (polls every 5 seconds)

---

## Troubleshooting

### Issue: Transcription doesn't continue when navigating away

**Solution**: Ensure background processor is initialized in `main.tsx`:

```typescript
import { backgroundTranscriptionProcessor } from './services/backgroundTranscriptionProcessor';
backgroundTranscriptionProcessor.initialize();
```

### Issue: No data auto-populated

**Possible causes**:
1. Transcript doesn't contain recognizable patterns
2. Session not started with `backgroundTranscriptionProcessor.startSession()`
3. Lead ID not set correctly

**Debug**:
```typescript
// Check active session
const session = useTranscriptionStore.getState().getActiveSession();
console.log('Active session:', session);

// Check extracted data
const data = backgroundTranscriptionProcessor.getExtractedData(leadId);
console.log('Extracted data:', data);
```

### Issue: Low confidence scores

**Causes**:
- Short transcripts (< 50 words)
- Unclear or ambiguous language
- Missing key information

**Solutions**:
- Encourage more detailed voice notes
- Use specific terminology (e.g., "combi boiler" instead of "boiler")
- Mention key details explicitly

---

## Future Enhancements

### Planned Features

- [ ] LLM-powered extraction (currently deterministic pattern matching)
- [ ] WebSocket real-time sync (currently polling every 5 seconds)
- [ ] Multi-user collaboration
- [ ] Conflict resolution for manual vs auto-populated fields
- [ ] Historical tracking of auto-population changes
- [ ] Export/import of extracted data
- [ ] Custom extraction rules per account

### Integration Points

Ready for integration with:
- Supabase Realtime (see `/docs/REALTIME-SYNC-4-WEEK-BUILD-PLAN.md`)
- Firebase Firestore
- WebSocket server
- GraphQL subscriptions

---

## Performance Considerations

- **Processing**: Extraction runs in main thread but is optimized for speed
- **Storage**: Uses localStorage for metadata (< 100KB per lead typically)
- **Polling**: 5-second interval for real-time updates (configurable in hook)
- **Memory**: Transcripts stored in Zustand with localStorage persistence

### Optimization Tips

1. **Reduce polling frequency** if not needed in real-time:
   ```typescript
   // Change 5000 to 10000 for 10-second polling
   const interval = setInterval(loadData, 10000);
   ```

2. **Clear old data** periodically:
   ```typescript
   backgroundTranscriptionProcessor.clearExtractedData(oldLeadId);
   ```

3. **Lazy load extracted data** only when needed:
   ```typescript
   const { isAvailable } = useExtractedData(leadId);
   // Only render detailed fields if isAvailable is true
   ```

---

## Contributing

When adding new extraction patterns:

1. Update `enhancedDataExtractor.ts` with new patterns
2. Add tests for pattern recognition
3. Update this documentation with examples
4. Update TypeScript interfaces if adding new data structures

---

## License

Proprietary - Hail-Mary © 2025

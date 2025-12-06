# Surveyor Engine Integration Guide

## Overview

This guide explains how to integrate and use the Surveyor Engine in your applications.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Your Application                     │
│  (Web App / PWA / Mobile App / Desktop App)             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Uses
                    ↓
┌─────────────────────────────────────────────────────────┐
│              useVoiceSurvey Hook (React)                │
│  - Integrates Web Speech APIs                           │
│  - Manages voice I/O                                     │
│  - Extracts answers from speech                          │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Uses
                    ↓
┌─────────────────────────────────────────────────────────┐
│              SurveyEngine (Core Logic)                   │
│  - Platform-agnostic state machine                       │
│  - Manages survey flow                                   │
│  - Validates answers                                     │
│  - Conditional navigation                                │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Loads
                    ↓
┌─────────────────────────────────────────────────────────┐
│         Survey Schema (JSON/TypeScript)                  │
│  - Question definitions                                  │
│  - Navigation logic                                      │
│  - Validation rules                                      │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Create Your Survey Schema

Create a JSON file defining your survey questions and flow:

```json
[
  {
    "id": "question_1",
    "promptText": "What is the property type?",
    "inputType": "text",
    "next": "question_2"
  },
  {
    "id": "question_2",
    "promptText": "How many bedrooms?",
    "inputType": "number",
    "validationRule": { "min": 1, "max": 10 },
    "next": {
      "conditions": [
        { "condition": "> 3", "nextNode": "large_property" },
        { "condition": "<= 3", "nextNode": "small_property" }
      ]
    }
  },
  {
    "id": "large_property",
    "promptText": "Is there space for a larger boiler?",
    "inputType": "boolean",
    "next": "finish"
  },
  {
    "id": "small_property",
    "promptText": "Is wall mounting an option?",
    "inputType": "boolean",
    "next": "finish"
  }
]
```

### 2. Use in Your React Component

```tsx
import { useVoiceSurvey } from '@/hooks/useVoiceSurvey';
import type { SurveyNode } from '@hail-mary/surveyor-engine';
import mySchema from './my-survey.json';

function MySurveyComponent() {
  const {
    currentQuestion,
    isListening,
    isSpeaking,
    startSurvey,
    manualSubmit,
    surveyState,
    error
  } = useVoiceSurvey({
    schema: mySchema as SurveyNode[],
    onComplete: (answers) => {
      console.log('Survey completed!', answers);
      // Process answers...
    },
    language: 'en-GB',
    autoListen: true
  });

  return (
    <div>
      {!surveyState.started && (
        <button onClick={startSurvey}>Start Survey</button>
      )}
      
      {currentQuestion && (
        <div>
          <h2>{currentQuestion.promptText}</h2>
          {isListening && <p>🎤 Listening...</p>}
          {isSpeaking && <p>🔊 Speaking...</p>}
          
          {/* Manual input fallback */}
          {currentQuestion.inputType === 'boolean' && (
            <>
              <button onClick={() => manualSubmit(true)}>Yes</button>
              <button onClick={() => manualSubmit(false)}>No</button>
            </>
          )}
        </div>
      )}
      
      {surveyState.completed && (
        <div>
          <h2>Survey Complete!</h2>
          <pre>{JSON.stringify(surveyState.answers, null, 2)}</pre>
        </div>
      )}
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### 3. Use Engine Directly (Without Voice)

For non-voice scenarios (forms, chatbots, etc.):

```typescript
import { SurveyEngine, SurveyNode } from '@hail-mary/surveyor-engine';

const engine = new SurveyEngine();
engine.loadSchema(mySchema);

// Start survey
const firstQ = engine.start();
console.log(firstQ.promptText);

// Submit answers
const nextQ = engine.submitAnswer(userAnswer);

// Check completion
if (engine.isComplete()) {
  const allAnswers = engine.getAnswers();
  console.log('Collected:', allAnswers);
}
```

## Input Types & Validation

### Boolean
- **Valid answers**: `true` or `false`
- **Voice recognition**: Detects "yes", "yeah", "yep", "no", "nope", "nah"
- **Navigation**: Use `if_true` and `if_false` in next logic

### Number
- **Valid answers**: Any number
- **Validation**: Optional `min` and `max` constraints
- **Voice recognition**: Extracts numbers from speech ("fifteen years" → 15)
- **Navigation**: Use `conditions` with operators: `>`, `>=`, `<`, `<=`, `==`, `!=`

### Text
- **Valid answers**: Any string
- **Validation**: Optional `regex` pattern
- **Voice recognition**: Uses raw transcript
- **Navigation**: Typically uses simple string next or default

## Navigation Logic

### Simple Navigation
```json
{
  "id": "question_1",
  "next": "question_2"
}
```

### Boolean Navigation
```json
{
  "id": "has_gas",
  "inputType": "boolean",
  "next": {
    "if_true": "gas_meter_location",
    "if_false": "alternative_fuel"
  }
}
```

### Conditional Navigation
```json
{
  "id": "boiler_age",
  "inputType": "number",
  "next": {
    "conditions": [
      { "condition": "> 15", "nextNode": "replacement_needed" },
      { "condition": "> 10", "nextNode": "service_check" },
      { "condition": "<= 10", "nextNode": "routine_service" }
    ],
    "default": "finish"
  }
}
```

## Voice Configuration

### Language Support
```typescript
useVoiceSurvey({
  schema: mySchema,
  language: 'en-GB',  // British English
  // Or: 'en-US', 'es-ES', 'fr-FR', etc.
})
```

### Auto-Listen Behavior
```typescript
useVoiceSurvey({
  schema: mySchema,
  autoListen: true,  // Auto-start listening after speaking
})
```

## Error Handling

The hook provides comprehensive error handling:

```tsx
const { error } = useVoiceSurvey({ ... });

if (error) {
  // Handle errors:
  // - Speech recognition not supported
  // - Microphone permission denied
  // - Invalid answers
  // - Validation failures
  console.error(error);
}
```

## Best Practices

1. **Keep questions clear and concise** - Voice synthesis works best with natural language
2. **Provide manual input fallbacks** - Not all browsers support Speech Recognition
3. **Use validation rules** - Prevent invalid data from entering your system
4. **Test on multiple browsers** - Speech APIs have varying support
5. **Handle errors gracefully** - Guide users when voice fails
6. **Save progress** - Store `surveyState.answers` periodically for long surveys

## Browser Compatibility

### Speech Synthesis (Speaking)
✅ Chrome, Edge, Safari, Firefox (all major browsers)

### Speech Recognition (Listening)
✅ Chrome, Edge (Chromium-based)
⚠️ Safari (limited support)
❌ Firefox (not supported)

**Recommendation**: Always provide manual input options as fallback.

## Example Use Cases

1. **Field Surveys** - HVAC installers collecting property information
2. **Customer Intake** - Hands-free data collection during site visits
3. **Quality Checks** - Guided inspection workflows
4. **Training** - Interactive learning modules
5. **Accessibility** - Voice-first interfaces for users with mobility issues

## Troubleshooting

### Voice recognition not working
- Check browser support (use Chrome/Edge)
- Ensure HTTPS connection (required for microphone access)
- Check microphone permissions
- Verify `autoListen` setting

### Answers not being recognized
- Speak clearly at normal pace
- Use manual input for complex answers
- Check validation rules in schema
- Test with different phrasings

### Survey not progressing
- Check navigation logic in schema
- Verify all referenced node IDs exist
- Look for missing 'finish' endpoints
- Check console for errors

## Support

For issues or questions:
1. Check the README in `packages/surveyor-engine/`
2. Review the example in `packages/pwa/src/hooks/VoiceSurveyExample.tsx`
3. Run the test: `cd packages/surveyor-engine && npm run build && node dist/test.js`

## License

ISC

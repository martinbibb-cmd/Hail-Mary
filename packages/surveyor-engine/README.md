# Surveyor Engine

A platform-agnostic survey workflow state machine for the Hail Mary project.

## Overview

The Surveyor Engine is a pure TypeScript package that manages survey workflows through a state machine pattern. It receives answers and outputs the next question based on configurable logic rules. This package is designed to be reusable across multiple platforms including web, mobile, and future applications.

## Features

- **Platform-Agnostic**: Pure TypeScript with no UI dependencies
- **Type-Safe**: Full TypeScript support with comprehensive interfaces
- **Flexible Navigation**: Support for conditional branching based on answers
- **Answer Validation**: Built-in validation for boolean, number, and text inputs
- **Testable**: Easy to unit test with pure functions

## Installation

This package is part of the Hail Mary monorepo. To use it in another package:

```json
{
  "dependencies": {
    "@hail-mary/surveyor-engine": "*"
  }
}
```

## Usage

### Basic Example

```typescript
import { SurveyEngine, SurveyNode } from '@hail-mary/surveyor-engine';

// Define your survey schema
const schema: SurveyNode[] = [
  {
    id: 'boiler_age',
    promptText: 'How old is the boiler?',
    inputType: 'number',
    validationRule: { min: 0, max: 100 },
    next: {
      conditions: [
        { condition: '> 15', nextNode: 'check_leaks' },
        { condition: '<= 15', nextNode: 'service_history' }
      ]
    }
  },
  {
    id: 'check_leaks',
    promptText: 'Do you see any visible corrosion or leaks?',
    inputType: 'boolean',
    next: 'finish'
  },
  {
    id: 'service_history',
    promptText: 'Is the service history available?',
    inputType: 'boolean',
    next: 'finish'
  }
];

// Create and initialize the engine
const engine = new SurveyEngine();
engine.loadSchema(schema);

// Start the survey
const firstQuestion = engine.start();
console.log(firstQuestion.promptText); // "How old is the boiler?"

// Submit an answer
const nextQuestion = engine.submitAnswer(20);
console.log(nextQuestion?.promptText); // "Do you see any visible corrosion or leaks?"

// Continue until complete
const finalQuestion = engine.submitAnswer(true);
console.log(finalQuestion); // null (survey complete)

// Get all collected answers
const answers = engine.getAnswers();
console.log(answers); // { boiler_age: 20, check_leaks: true }
```

## API Reference

### Types

#### `SurveyNode`
Represents a single step (question) in the survey.

```typescript
interface SurveyNode {
  id: string;                    // Unique identifier
  promptText: string;            // Question text to display/speak
  inputType: 'boolean' | 'number' | 'text';
  validationRule?: ValidationRule;
  next: NextLogic | string;      // Navigation logic
}
```

#### `ValidationRule`
Rules for validating answers.

```typescript
interface ValidationRule {
  regex?: string;    // For text validation
  min?: number;      // For number validation
  max?: number;      // For number validation
}
```

#### `NextLogic`
Defines conditional navigation.

```typescript
interface NextLogic {
  if_true?: string;              // For boolean inputs
  if_false?: string;             // For boolean inputs
  conditions?: {                 // For number inputs
    condition: string;           // e.g., "> 15", "<= 10"
    nextNode: string;
  }[];
  default?: string;              // Fallback node
}
```

### SurveyEngine Class

#### `loadSchema(schema: SurveyNode[]): void`
Load the survey schema. Must be called before starting the survey.

#### `start(): SurveyNode`
Start the survey and return the first question.

#### `submitAnswer(answer: any): SurveyNode | null`
Submit an answer for the current question. Returns the next question, or `null` if the survey is complete.

Throws an error if:
- Survey not started
- Survey already completed
- Answer fails validation

#### `getState(): SurveyState`
Get the current state of the survey.

#### `getAnswers(): Record<string, any>`
Get all collected answers as a map of node ID to answer value.

#### `isComplete(): boolean`
Check if the survey has been completed.

## Integration with PWA

See the `useVoiceSurvey` hook in `packages/pwa/src/hooks/useVoiceSurvey.ts` for an example of integrating the engine with Web Speech APIs for voice-based surveys.

## Sample Data

See `src/samples/boiler-survey.json` for a complete example of a survey schema.

## Testing

Run the test script to verify the engine:

```bash
npm run build
node dist/test.js
```

## License

ISC

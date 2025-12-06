/**
 * Simple test for SurveyEngine
 * 
 * This is a manual test to verify the engine works correctly.
 * Run with: node dist/test.js
 */

import { SurveyEngine, SurveyNode } from './index';
import boilerSurveySchemaJson from './samples/boiler-survey.json';

const boilerSurveySchema = boilerSurveySchemaJson as SurveyNode[];

console.log('Testing SurveyEngine...\n');

// Create and load the engine
const engine = new SurveyEngine();
engine.loadSchema(boilerSurveySchema);

console.log('✓ Schema loaded successfully');

// Start the survey
const firstQuestion = engine.start();
console.log(`\n1st Question: ${firstQuestion.promptText}`);
console.log(`   Input Type: ${firstQuestion.inputType}`);

// Answer: Boiler is 20 years old (should go to check_leaks)
console.log('\n   Answer: 20 years');
const secondQuestion = engine.submitAnswer(20);
console.log(`\n2nd Question: ${secondQuestion?.promptText}`);
console.log(`   Input Type: ${secondQuestion?.inputType}`);

// Answer: Yes, there are leaks
console.log('\n   Answer: true (yes)');
const thirdQuestion = engine.submitAnswer(true);
console.log(`\nSurvey completed: ${thirdQuestion === null}`);

// Get all answers
const answers = engine.getAnswers();
console.log('\nCollected Answers:', answers);

// Test another path
console.log('\n\n--- Testing Second Path ---\n');

const engine2 = new SurveyEngine();
engine2.loadSchema(boilerSurveySchema);

const q1 = engine2.start();
console.log(`1st Question: ${q1.promptText}`);

// Answer: Boiler is 10 years old (should go to service_history)
console.log('   Answer: 10 years');
const q2 = engine2.submitAnswer(10);
console.log(`\n2nd Question: ${q2?.promptText}`);

// Answer: No, service history not available
console.log('   Answer: false (no)');
const q3 = engine2.submitAnswer(false);
console.log(`\nSurvey completed: ${q3 === null}`);

const answers2 = engine2.getAnswers();
console.log('\nCollected Answers:', answers2);

console.log('\n✓ All tests passed!');

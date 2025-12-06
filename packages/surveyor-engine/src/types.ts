/**
 * Core type definitions for the Surveyor Engine
 * Platform-agnostic survey state machine types
 */

/**
 * Expected input type for a survey question
 */
export type ExpectedInput = 'boolean' | 'number' | 'text' | 'date';

/**
 * Validation rules for survey inputs
 */
export interface ValidationRules {
  min?: number;
  max?: number;
  regex?: string;
}

/**
 * Logic rule for determining the next question
 */
export interface PathRule {
  condition: string;
  nextId: string;
}

/**
 * A single step in the survey workflow
 */
export interface SurveyNode {
  id: string;
  prompt: string;
  expectedInput: ExpectedInput;
  validation?: ValidationRules;
  paths: PathRule[];
}

/**
 * Current state of a running survey
 */
export interface SurveyState {
  currentNodeId: string;
  history: Record<string, any>;
  isComplete: boolean;
}

/**
 * Survey Engine Types
 * 
 * Platform-agnostic types for the survey workflow state machine.
 */

/**
 * Input types supported by survey questions
 */
export type InputType = 'boolean' | 'number' | 'text';

/**
 * Logical operators for comparisons
 */
export type LogicOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq';

/**
 * Validation rule for question answers
 */
export interface ValidationRule {
  /** Regular expression pattern for text validation */
  regex?: string;
  /** Minimum value for number validation */
  min?: number;
  /** Maximum value for number validation */
  max?: number;
}

/**
 * Structured logic comparison for conditional navigation
 */
export interface LogicComparison {
  /** The operator to use (e.g., 'gt' for greater than) */
  operator: LogicOperator;
  /** The value to compare against */
  value: number | string | boolean;
  /** Node ID to navigate to if condition is met */
  nextNode: string;
}

/**
 * Logic object that determines the next node based on answer
 */
export interface NextLogic {
  /** Node ID to navigate to if boolean answer is true */
  if_true?: string;
  /** Node ID to navigate to if boolean answer is false */
  if_false?: string;
  /** Conditional navigation based on structured comparisons (processed in order) */
  conditions?: LogicComparison[];
  /** Default node ID if no conditions match */
  default?: string;
}

/**
 * Represents a single step (Question) in the survey
 */
export interface SurveyNode {
  /** Unique identifier for this node */
  id: string;
  /** The text that will be spoken/displayed to the user */
  promptText: string;
  /** The type of input expected from the user */
  inputType: InputType;
  /** Optional validation rules for the answer */
  validationRule?: ValidationRule;
  /** Can be a simple string (jump to X) or complex logic object */
  next: NextLogic | string;
}

/**
 * Current state of the survey
 */
export interface SurveyState {
  /** ID of the current node */
  currentNodeId: string | null;
  /** Map of all collected answers (nodeId -> answer value) */
  answers: Record<string, any>;
  /** Whether the survey has been completed */
  isComplete: boolean;
}

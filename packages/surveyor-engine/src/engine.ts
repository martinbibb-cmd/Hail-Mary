/**
 * SurveyEngine - Platform-agnostic state machine for survey workflows
 * Pure TypeScript implementation with no UI dependencies
 */

import type { SurveyNode, SurveyState, ExpectedInput } from './types';

export class SurveyEngine {
  private schema: SurveyNode[];
  private state: SurveyState;

  constructor(schema: SurveyNode[]) {
    if (!schema || schema.length === 0) {
      throw new Error('Survey schema cannot be empty');
    }
    this.schema = schema;
    this.state = {
      currentNodeId: '',
      history: {},
      isComplete: false,
    };
  }

  /**
   * Start the survey and return the first node
   */
  start(): SurveyNode {
    if (this.schema.length === 0) {
      throw new Error('Cannot start survey with empty schema');
    }
    
    const firstNode = this.schema[0];
    this.state.currentNodeId = firstNode.id;
    this.state.isComplete = false;
    
    return firstNode;
  }

  /**
   * Get the current state of the survey
   */
  getState(): SurveyState {
    return { ...this.state };
  }

  /**
   * Submit an answer and get the next node
   * Returns null if the survey is complete
   */
  submitAnswer(answer: any): SurveyNode | null {
    const currentNode = this.getCurrentNode();
    
    if (!currentNode) {
      throw new Error('No active survey node');
    }

    // Validate the answer
    this.validateAnswer(answer, currentNode);

    // Store the answer in history
    this.state.history[currentNode.id] = answer;

    // Evaluate paths to find the next node
    const nextNodeId = this.evaluatePaths(currentNode, answer);

    if (!nextNodeId) {
      // No next node means survey is complete
      this.state.isComplete = true;
      return null;
    }

    // Find and return the next node
    const nextNode = this.schema.find(node => node.id === nextNodeId);
    
    if (!nextNode) {
      throw new Error(`Next node with id "${nextNodeId}" not found in schema`);
    }

    this.state.currentNodeId = nextNodeId;
    return nextNode;
  }

  /**
   * Get the current node
   */
  private getCurrentNode(): SurveyNode | undefined {
    return this.schema.find(node => node.id === this.state.currentNodeId);
  }

  /**
   * Validate answer against node's expected input and validation rules
   */
  private validateAnswer(answer: any, node: SurveyNode): void {
    // Type validation
    switch (node.expectedInput) {
      case 'boolean':
        if (typeof answer !== 'boolean') {
          throw new Error(`Expected boolean, got ${typeof answer}`);
        }
        break;
      
      case 'number':
        if (typeof answer !== 'number' || isNaN(answer)) {
          throw new Error(`Expected number, got ${typeof answer}`);
        }
        break;
      
      case 'text':
        if (typeof answer !== 'string') {
          throw new Error(`Expected text, got ${typeof answer}`);
        }
        break;
      
      case 'date':
        // Accept Date object or ISO string
        if (!(answer instanceof Date) && typeof answer !== 'string') {
          throw new Error(`Expected date, got ${typeof answer}`);
        }
        // Validate date string if it's a string
        if (typeof answer === 'string') {
          const date = new Date(answer);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date string');
          }
        }
        break;
    }

    // Additional validation rules
    if (node.validation) {
      // Min/max validation for numbers
      if (node.expectedInput === 'number' && typeof answer === 'number') {
        if (node.validation.min !== undefined && answer < node.validation.min) {
          throw new Error(`Value ${answer} is below minimum ${node.validation.min}`);
        }
        if (node.validation.max !== undefined && answer > node.validation.max) {
          throw new Error(`Value ${answer} exceeds maximum ${node.validation.max}`);
        }
      }

      // Regex validation for text
      if (node.expectedInput === 'text' && node.validation.regex && typeof answer === 'string') {
        const regex = new RegExp(node.validation.regex);
        if (!regex.test(answer)) {
          throw new Error(`Value does not match required pattern`);
        }
      }
    }
  }

  /**
   * Evaluate path conditions to determine the next node
   * Returns the nextId of the first matching path, or null if no paths match
   */
  private evaluatePaths(node: SurveyNode, answer: any): string | null {
    if (!node.paths || node.paths.length === 0) {
      return null;
    }

    for (const path of node.paths) {
      if (this.evaluateCondition(path.condition, answer)) {
        return path.nextId;
      }
    }

    return null;
  }

  /**
   * Evaluate a single condition against an answer
   * Supports simple comparisons and boolean checks
   */
  private evaluateCondition(condition: string, answer: any): boolean {
    // Handle empty or 'default' conditions (always true)
    if (!condition || condition === 'default' || condition === 'true') {
      return true;
    }

    // Handle direct boolean comparisons
    if (condition === 'false') {
      return answer === false;
    }

    // Handle numeric comparisons
    const operators = ['>=', '<=', '>', '<', '===', '==', '!=', '!=='];
    
    for (const op of operators) {
      if (condition.includes(op)) {
        return this.evaluateComparison(condition, op, answer);
      }
    }

    // If no operator found, treat as direct equality check
    return this.parseValue(condition) === answer;
  }

  /**
   * Evaluate a comparison expression
   */
  private evaluateComparison(condition: string, operator: string, answer: any): boolean {
    const parts = condition.split(operator).map(p => p.trim());
    
    if (parts.length !== 2) {
      return false;
    }

    const leftValue = parts[0] === 'answer' ? answer : this.parseValue(parts[0]);
    const rightValue = parts[1] === 'answer' ? answer : this.parseValue(parts[1]);

    switch (operator) {
      case '>':
        return leftValue > rightValue;
      case '<':
        return leftValue < rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '===':
      case '==':
        return leftValue === rightValue;
      case '!==':
      case '!=':
        return leftValue !== rightValue;
      default:
        return false;
    }
  }

  /**
   * Parse a string value to its appropriate type
   */
  private parseValue(value: string): any {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }
    
    // String (remove quotes if present)
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    return value;
  }
}

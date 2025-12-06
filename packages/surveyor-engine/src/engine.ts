/**
 * Survey Engine
 * 
 * A platform-agnostic state machine that manages survey workflow.
 * Receives answers and outputs the next question based on logic rules.
 */

import { SurveyNode, SurveyState, InputType, ValidationRule, NextLogic } from './types';

export class SurveyEngine {
  private schema: SurveyNode[] = [];
  private state: SurveyState = {
    currentNodeId: null,
    answers: {},
    started: false,
    completed: false,
  };

  /**
   * Load the survey schema (definitions)
   * @param schema Array of SurveyNode objects defining the survey flow
   */
  loadSchema(schema: SurveyNode[]): void {
    if (!schema || schema.length === 0) {
      throw new Error('Survey schema must contain at least one node');
    }
    this.schema = schema;
    this.state = {
      currentNodeId: null,
      answers: {},
      started: false,
      completed: false,
    };
  }

  /**
   * Start the survey and return the first node
   * @returns The first SurveyNode in the schema
   */
  start(): SurveyNode {
    if (this.schema.length === 0) {
      throw new Error('No schema loaded. Call loadSchema() first.');
    }
    
    const firstNode = this.schema[0];
    this.state.currentNodeId = firstNode.id;
    this.state.started = true;
    this.state.completed = false;
    
    return firstNode;
  }

  /**
   * Submit an answer for the current node and get the next node
   * @param answer The user's answer to the current question
   * @returns The next SurveyNode, or null if the survey is complete
   */
  submitAnswer(answer: any): SurveyNode | null {
    if (!this.state.started) {
      throw new Error('Survey not started. Call start() first.');
    }

    if (this.state.completed) {
      throw new Error('Survey already completed.');
    }

    if (this.state.currentNodeId === null) {
      throw new Error('No current node.');
    }

    const currentNode = this.findNodeById(this.state.currentNodeId);
    if (!currentNode) {
      throw new Error(`Current node not found: ${this.state.currentNodeId}`);
    }

    // Validate the answer
    this.validateAnswer(answer, currentNode.inputType, currentNode.validationRule);

    // Store the answer
    this.state.answers[currentNode.id] = answer;

    // Determine the next node
    const nextNodeId = this.determineNextNode(currentNode, answer);

    if (nextNodeId === null || nextNodeId === 'finish') {
      // Survey is complete
      this.state.completed = true;
      this.state.currentNodeId = null;
      return null;
    }

    const nextNode = this.findNodeById(nextNodeId);
    if (!nextNode) {
      throw new Error(`Next node not found: ${nextNodeId}`);
    }

    this.state.currentNodeId = nextNode.id;
    return nextNode;
  }

  /**
   * Get the current state of the survey
   * @returns The current SurveyState
   */
  getState(): SurveyState {
    return { ...this.state };
  }

  /**
   * Get all collected answers
   * @returns Map of nodeId to answer value
   */
  getAnswers(): Record<string, any> {
    return { ...this.state.answers };
  }

  /**
   * Check if the survey is complete
   * @returns true if the survey is completed
   */
  isComplete(): boolean {
    return this.state.completed;
  }

  /**
   * Find a node by its ID
   * @param nodeId The ID of the node to find
   * @returns The SurveyNode or undefined
   */
  private findNodeById(nodeId: string): SurveyNode | undefined {
    return this.schema.find(node => node.id === nodeId);
  }

  /**
   * Validate an answer against input type and validation rules
   * @param answer The answer to validate
   * @param inputType The expected input type
   * @param validationRule Optional validation rule
   */
  private validateAnswer(answer: any, inputType: InputType, validationRule?: ValidationRule): void {
    switch (inputType) {
      case 'boolean':
        if (typeof answer !== 'boolean') {
          throw new Error('Answer must be a boolean (true/false)');
        }
        break;
      
      case 'number':
        if (typeof answer !== 'number' || isNaN(answer)) {
          throw new Error('Answer must be a valid number');
        }
        if (validationRule) {
          if (validationRule.min !== undefined && answer < validationRule.min) {
            throw new Error(`Answer must be at least ${validationRule.min}`);
          }
          if (validationRule.max !== undefined && answer > validationRule.max) {
            throw new Error(`Answer must be at most ${validationRule.max}`);
          }
        }
        break;
      
      case 'text':
        if (typeof answer !== 'string') {
          throw new Error('Answer must be a string');
        }
        if (validationRule && validationRule.regex) {
          const regex = new RegExp(validationRule.regex);
          if (!regex.test(answer)) {
            throw new Error('Answer does not match the required format');
          }
        }
        break;
    }
  }

  /**
   * Determine the next node based on the current node's logic and the answer
   * @param currentNode The current SurveyNode
   * @param answer The user's answer
   * @returns The ID of the next node, or null if finished
   */
  private determineNextNode(currentNode: SurveyNode, answer: any): string | null {
    const next = currentNode.next;

    // If next is a simple string, return it
    if (typeof next === 'string') {
      return next;
    }

    // Handle boolean logic
    if (currentNode.inputType === 'boolean') {
      const logic = next as NextLogic;
      if (answer === true && logic.if_true) {
        return logic.if_true;
      }
      if (answer === false && logic.if_false) {
        return logic.if_false;
      }
    }

    // Handle conditional logic (for numbers)
    if (currentNode.inputType === 'number') {
      const logic = next as NextLogic;
      if (logic.conditions) {
        for (const cond of logic.conditions) {
          if (this.evaluateCondition(answer, cond.condition)) {
            return cond.nextNode;
          }
        }
      }
    }

    // Return default if available
    const logic = next as NextLogic;
    if (logic.default) {
      return logic.default;
    }

    // No next node found
    return null;
  }

  /**
   * Evaluate a condition against a value
   * @param value The value to test
   * @param condition The condition string (e.g., "> 15", "<= 10")
   * @returns true if condition is met
   */
  private evaluateCondition(value: number, condition: string): boolean {
    const match = condition.match(/^(>=|<=|>|<|==|=|!=)\s*(\d+)$/);
    if (!match) {
      throw new Error(`Invalid condition format: ${condition}`);
    }

    const operator = match[1];
    const threshold = parseFloat(match[2]);

    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '==':
      case '=':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

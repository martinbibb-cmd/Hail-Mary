/**
 * Survey Engine
 * 
 * A platform-agnostic state machine that manages survey workflow.
 * Receives answers and outputs the next question based on logic rules.
 */

import { SurveyNode, SurveyState, InputType, ValidationRule, NextLogic, LogicComparison } from './types';

export class SurveyEngine {
  private schema: SurveyNode[] = [];
  private nodeMap: Map<string, SurveyNode> = new Map();
  private state: SurveyState = {
    currentNodeId: null,
    answers: {},
    isComplete: false,
  };

  /**
   * Constructor that accepts and validates a survey schema
   * @param schema Array of SurveyNode objects defining the survey flow
   */
  constructor(schema: SurveyNode[]) {
    if (!schema || schema.length === 0) {
      throw new Error('Survey schema must contain at least one node');
    }
    
    // Build a lookup map for faster node retrieval
    for (const node of schema) {
      this.nodeMap.set(node.id, node);
    }
    
    // Validate that all nextNode IDs exist in the schema
    this.validateSchema(schema);
    
    this.schema = schema;
  }

  /**
   * Validate that all nextNode references exist in the schema
   * @param schema The schema to validate
   */
  private validateSchema(schema: SurveyNode[]): void {
    for (const node of schema) {
      const nextNodeIds = this.extractNextNodeIds(node.next);
      
      for (const nextNodeId of nextNodeIds) {
        // Allow 'END' as a special value to end the survey
        if (nextNodeId !== 'END' && !this.nodeMap.has(nextNodeId)) {
          throw new Error(`Invalid schema: Node '${node.id}' references non-existent node '${nextNodeId}'`);
        }
      }
    }
  }

  /**
   * Extract all possible next node IDs from a next property
   * @param next The next property (string or NextLogic)
   * @returns Array of node IDs
   */
  private extractNextNodeIds(next: NextLogic | string): string[] {
    if (typeof next === 'string') {
      return [next];
    }

    const ids: string[] = [];
    
    if (next.if_true) ids.push(next.if_true);
    if (next.if_false) ids.push(next.if_false);
    if (next.default) ids.push(next.default);
    
    if (next.conditions) {
      for (const condition of next.conditions) {
        ids.push(condition.nextNode);
      }
    }
    
    return ids;
  }

  /**
   * Start the survey and return the first node
   * @returns The first SurveyNode in the schema
   */
  start(): SurveyNode {
    const firstNode = this.schema[0];
    this.state.currentNodeId = firstNode.id;
    this.state.answers = {};
    this.state.isComplete = false;
    
    return firstNode;
  }

  /**
   * Submit an answer for the current node and get the next node
   * @param answer The user's answer to the current question
   * @returns The next SurveyNode, or null if the survey is complete
   */
  submitAnswer(answer: any): SurveyNode | null {
    if (this.state.isComplete) {
      throw new Error('Survey already completed.');
    }

    if (this.state.currentNodeId === null) {
      throw new Error('Survey not started. Call start() first.');
    }

    const currentNode = this.nodeMap.get(this.state.currentNodeId);
    if (!currentNode) {
      throw new Error(`Current node not found: ${this.state.currentNodeId}`);
    }

    // Validate the answer
    this.validateAnswer(currentNode, answer);

    // Store the answer
    this.state.answers[currentNode.id] = answer;

    // Determine the next node
    const nextNodeId = this.evaluateNextNode(currentNode, answer);

    if (nextNodeId === null || nextNodeId === 'END') {
      // Survey is complete
      this.state.isComplete = true;
      this.state.currentNodeId = null;
      return null;
    }

    const nextNode = this.nodeMap.get(nextNodeId);
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
    return this.state.isComplete;
  }

  /**
   * Validate an answer against the node's input type and validation rules
   * @param node The SurveyNode containing validation rules
   * @param answer The answer to validate
   * @returns true if valid (throws Error if invalid)
   */
  private validateAnswer(node: SurveyNode, answer: any): boolean {
    const { inputType, validationRule } = node;
    
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
            throw new Error(`Value ${answer} is below minimum ${validationRule.min}`);
          }
          if (validationRule.max !== undefined && answer > validationRule.max) {
            throw new Error(`Value ${answer} exceeds maximum ${validationRule.max}`);
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
    
    return true;
  }

  /**
   * Evaluate the next node based on the current node's logic and the answer
   * @param node The current SurveyNode
   * @param answer The user's answer
   * @returns The ID of the next node, or null if finished
   */
  private evaluateNextNode(node: SurveyNode, answer: any): string | null {
    const next = node.next;

    // If next is a simple string, return it
    if (typeof next === 'string') {
      return next;
    }

    const logic = next as NextLogic;

    // Handle boolean logic
    if (node.inputType === 'boolean') {
      if (answer === true && logic.if_true) {
        return logic.if_true;
      }
      if (answer === false && logic.if_false) {
        return logic.if_false;
      }
    }

    // Handle conditional logic (works for any input type)
    if (logic.conditions) {
      for (const cond of logic.conditions) {
        if (this.evaluateComparison(answer, cond)) {
          return cond.nextNode;
        }
      }
    }

    // Return default if available
    if (logic.default) {
      return logic.default;
    }

    // No next node found
    return null;
  }

  /**
   * Evaluate a structured comparison
   * @param value The value to test
   * @param comparison The LogicComparison to evaluate
   * @returns true if comparison is met
   */
  private evaluateComparison(value: number | string | boolean, comparison: LogicComparison): boolean {
    const { operator, value: compareValue } = comparison;
    
    switch (operator) {
      case 'gt':
        return value > compareValue;
      case 'gte':
        return value >= compareValue;
      case 'lt':
        return value < compareValue;
      case 'lte':
        return value <= compareValue;
      case 'eq':
        return value === compareValue;
      case 'neq':
        return value !== compareValue;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}

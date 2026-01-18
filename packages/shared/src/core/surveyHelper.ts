/**
 * SurveyHelper Interface
 * 
 * Core service for providing context-aware helper questions during surveys.
 * Given SpecDraft, activeModules, currentTopic → returns helper question + chips.
 */

import type { 
  SurveySlot, 
  ModuleName, 
  TopicTag, 
  SystemSpecDraft,
  ModuleCompleteness,
} from '../types.js';

/**
 * Context for determining the next helper question
 */
export interface HelperContext {
  /** Current spec draft with all data */
  specDraft: SystemSpecDraft;
  /** Active modules for this survey */
  activeModules: ModuleName[];
  /** Current topic being discussed */
  currentTopic: TopicTag;
  /** Slot IDs already asked in this session */
  askedSlotIds: string[];
  /** Recent transcript segments (for context) */
  recentTranscript?: string;
}

/**
 * Result from asking for the next question
 */
export interface NextQuestionResult {
  /** The slot to present (null if all done) */
  slot: SurveySlot | null;
  /** Module completeness summary */
  completeness: ModuleCompleteness[];
  /** Overall completion percentage */
  overallPercentage: number;
  /** Message to display */
  message?: string;
  /** Reason no question returned */
  reason?: 'all_done' | 'topic_complete' | 'no_more_critical';
}

/**
 * Result from answering a question
 */
export interface AnswerResult {
  /** Whether the answer was successfully recorded */
  success: boolean;
  /** The spec path that was updated */
  updatedPath: string;
  /** Optional message */
  message?: string;
  /** Next suggested question (if any) */
  nextSlot?: SurveySlot;
}

/**
 * Module completeness summary
 */
export interface CompletenessResult {
  /** Per-module completeness */
  modules: ModuleCompleteness[];
  /** Overall percentage */
  overallPercentage: number;
  /** Whether survey is ready for quoting */
  readyToQuote: boolean;
  /** Warning messages */
  warnings: string[];
}

/**
 * SurveyHelper interface - provides context-aware questions
 */
export interface ISurveyHelper {
  /**
   * Get the next recommended question based on context
   */
  getNextQuestion(context: HelperContext): NextQuestionResult;

  /**
   * Get the next question for a specific topic
   */
  getNextQuestionForTopic(context: HelperContext, topic: TopicTag): NextQuestionResult;

  /**
   * Get all unanswered slots for a module
   */
  getUnansweredSlots(context: HelperContext, module: ModuleName): SurveySlot[];

  /**
   * Get all critical unanswered slots
   */
  getCriticalUnansweredSlots(context: HelperContext): SurveySlot[];

  /**
   * Calculate completeness for all modules
   */
  calculateCompleteness(context: HelperContext): CompletenessResult;

  /**
   * Check if a slot's preconditions are met
   */
  checkPreconditions(slot: SurveySlot, specDraft: SystemSpecDraft): boolean;

  /**
   * Get slots that should trigger on topic change
   */
  getSlotsForTopicChange(context: HelperContext, newTopic: TopicTag): SurveySlot[];

  /**
   * Get rare hazard slots that should trigger based on transcript
   */
  getRareHazardSlots(context: HelperContext): SurveySlot[];

  /**
   * Register a slot answer
   */
  recordAnswer(
    sessionId: number,
    slotId: string,
    value: unknown,
    source: 'chip' | 'voice' | 'manual'
  ): Promise<AnswerResult>;

  /**
   * Get all available slots for current context
   */
  getAvailableSlots(context: HelperContext): SurveySlot[];

  /**
   * Search for relevant slots based on transcript keywords
   */
  findRelevantSlots(context: HelperContext, keywords: string[]): SurveySlot[];
}

/**
 * Priority weights for slot selection
 */
export const PRIORITY_WEIGHTS = {
  critical: 100,
  important: 50,
  nice_to_have: 10,
} as const;

/**
 * Trigger mode priorities (lower = higher priority)
 */
export const TRIGGER_PRIORITIES = {
  rare_hazard: 1,
  topic_change: 2,
  always: 3,
  on_request: 4,
} as const;

/**
 * Sarah Explanation Layer Types
 * 
 * Sarah is a subordinate explanation layer that:
 * - Consumes ONLY RockyFacts (readonly)
 * - Produces human-readable explanations for a given audience
 * - May NOT introduce new technical claims
 * - Adds tone, context, and clarity to Rocky's facts
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 */

import type { RockyFacts } from '../rocky/types.js';

// ============================================
// Sarah Input/Output Types
// ============================================

/**
 * Target audience for explanations
 */
export type SarahAudience = 
  | 'customer'        // Homeowner, non-technical
  | 'engineer'        // Heating engineer, technical
  | 'surveyor'        // Survey team, practical
  | 'manager'         // Project manager, overview
  | 'admin';          // Office admin, administrative

/**
 * Explanation style/tone
 */
export type SarahTone = 
  | 'professional'    // Formal, business-like
  | 'friendly'        // Warm, approachable
  | 'technical'       // Precise, detailed
  | 'simple'          // Easy to understand
  | 'urgent';         // Action-focused

/**
 * Sarah explanation request
 */
export interface SarahExplainRequest {
  rockyFacts: RockyFacts;
  audience: SarahAudience;
  tone?: SarahTone;
  sections?: string[]; // Specific sections to explain (optional)
  maxLength?: number;  // Max words/characters (optional)
}

/**
 * Sarah explanation result
 */
export interface SarahExplanation {
  // Metadata
  audience: SarahAudience;
  tone: SarahTone;
  generatedAt: Date;
  rockyFactsVersion: string;
  
  // Explanations organized by section
  sections: {
    // Overall summary for the audience
    summary?: string;
    
    // Explained sections (based on RockyFacts)
    customerContext?: string;
    propertyDescription?: string;
    systemAssessment?: string;
    measurementsSummary?: string;
    materialsExplanation?: string;
    hazardsWarning?: string;
    nextStepsGuidance?: string;
  };
  
  // Additional context (but NO new technical claims)
  context?: {
    whyItMatters?: string;    // Why these facts matter
    whatToExpect?: string;    // What happens next
    commonQuestions?: string[]; // Anticipated questions
  };
  
  // Compliance note
  disclaimer: string; // Standard disclaimer noting this is based on survey facts
}

/**
 * Sarah processing result
 */
export interface SarahProcessResult {
  success: boolean;
  explanation: SarahExplanation;
  processingTimeMs: number;
  errors?: string[];
  warnings?: string[];
}

// ============================================
// Sarah Configuration
// ============================================

/**
 * Sarah configuration (LLM settings for explanation generation)
 */
export interface SarahConfig {
  // Version
  engineVersion: string;
  
  // LLM provider for explanations
  llmProvider?: {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey: string;
    temperature: number; // Higher temp OK for explanations
    maxTokens: number;
  };
  
  // Audience-specific templates
  audienceTemplates: {
    [key in SarahAudience]: {
      systemPrompt: string;
      disclaimerTemplate: string;
    };
  };
  
  // Tone guidelines
  toneGuidelines: {
    [key in SarahTone]: string;
  };
  
  // Safety rules (prevent Sarah from adding new facts)
  safetyRules: {
    prohibitedPhrases: string[]; // Phrases that introduce new claims
    requiredDisclaimer: string;
    maxDeviationFromFacts: number; // How much interpretation allowed (0-100)
  };
}

// ============================================
// Sarah Validation Types
// ============================================

/**
 * Validation result for Sarah's output
 * Ensures Sarah hasn't introduced new technical claims
 */
export interface SarahValidationResult {
  valid: boolean;
  issues: Array<{
    type: 'new_claim' | 'contradicts_facts' | 'missing_disclaimer' | 'inappropriate_tone';
    severity: 'error' | 'warning';
    message: string;
    location?: string;
  }>;
}

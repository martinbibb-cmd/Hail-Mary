/**
 * Sarah Explanation Layer
 * 
 * A subordinate explanation layer that consumes Rocky's facts.
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 * 
 * Sarah's responsibilities:
 * - Consume RockyFacts (readonly, no modification)
 * - Generate human-readable explanations
 * - Adapt tone and style for target audience
 * - Add context and clarity
 * 
 * Sarah does NOT:
 * - Add new technical claims
 * - Make decisions about facts
 * - Modify or contradict Rocky's facts
 * - Generate facts from transcripts (that's Rocky's job)
 */

export * from './types.js';

/**
 * Rocky Logic Engine
 * 
 * A deterministic, auditable logic engine for processing voice notes.
 * 
 * Architectural Rule: Rocky decides. Sarah explains.
 * 
 * Rocky's responsibilities:
 * - Consume transcripts / natural notes (verbatim)
 * - Derive structured facts using deterministic rules (no LLM)
 * - Output RockyFacts (versioned JSON contract)
 * - Generate Automatic Notes from facts
 * - Generate Engineer Basics (fixed format)
 * 
 * Rocky does NOT:
 * - Use LLMs for interpretation
 * - Add tone or prose
 * - Generate explanations (that's Sarah's job)
 */

export * from './types';

/**
 * Atlas Voice - Entities, Events, and Domain Knowledge
 *
 * This module provides the foundation for Rocky v2's entity + event extraction system.
 *
 * Usage:
 * ```typescript
 * import {
 *   Entity,
 *   Event,
 *   EntityEventExtraction,
 *   BOILER_MAKE_ALIASES,
 *   DIAGNOSTIC_PATTERNS,
 *   EXPANDED_BOILER_MODELS,
 *   EXPANDED_FAULT_CODES,
 * } from '@hail-mary/shared/atlas-voice';
 * ```
 */

// Entity and Event types
export * from './entities-events-schema';

// Domain knowledge catalogs (base)
export * from './domain-knowledge-catalog';

// Domain knowledge catalogs (expanded)
export * from './domain-knowledge-catalog-expanded';

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
 * } from '@hail-mary/shared/atlas-voice';
 * ```
 */

// Entity and Event types
export * from './entities-events-schema';

// Domain knowledge catalogs
export * from './domain-knowledge-catalog';

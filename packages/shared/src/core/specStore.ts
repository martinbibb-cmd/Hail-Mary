/**
 * SpecStore Interface
 * 
 * Core service for managing HomeProfile and SystemSpecDraft data.
 * Central store for all survey data across modules.
 */

import type { SystemSpecDraft, ModuleName } from '../types';

/**
 * HomeProfile - static/slow-changing property information
 */
export interface HomeProfile {
  /** Property type */
  propertyType?: 'house' | 'flat' | 'bungalow' | 'other';
  /** Approximate build year band */
  buildYearApprox?: string;
  /** Number of bedrooms */
  bedrooms?: number;
  /** Number of bathrooms */
  bathrooms?: number;
  /** Total floor area in m² */
  floorAreaSqm?: number;
  /** Property address */
  address?: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
  /** Wall construction type */
  wallConstruction?: 'cavity' | 'solid' | 'mixed' | 'unknown';
  /** Roof type */
  roofType?: 'pitched' | 'flat' | 'mixed';
  /** Has loft space */
  hasLoft?: boolean;
  /** Has garage */
  hasGarage?: boolean;
  /** Has off-street parking */
  hasOffStreetParking?: boolean;
  /** Conservation area */
  inConservationArea?: boolean;
  /** Listed building */
  isListedBuilding?: boolean;
}

/**
 * Spec update operation
 */
export interface SpecUpdate {
  /** Dot-notation path to update (e.g., 'centralHeating.existingHeatSource.systemType') */
  path: string;
  /** New value to set */
  value: unknown;
  /** Source of the update */
  source?: 'voice' | 'chip' | 'manual' | 'ai';
}

/**
 * Spec change event for subscribers
 */
export interface SpecChangeEvent {
  /** Session ID */
  sessionId: number;
  /** Path that changed */
  path: string;
  /** Previous value */
  previousValue: unknown;
  /** New value */
  newValue: unknown;
  /** Timestamp of change */
  timestamp: Date;
}

/**
 * SpecStore interface - holds HomeProfile + SystemSpecDraft
 */
export interface ISpecStore {
  /**
   * Initialize or load a spec draft for a session
   */
  initSession(sessionId: number, activeModules: ModuleName[]): Promise<SystemSpecDraft>;

  /**
   * Get the current spec draft
   */
  getSpec(sessionId: number): Promise<SystemSpecDraft | null>;

  /**
   * Get home profile for a lead
   */
  getHomeProfile(leadId: number): Promise<HomeProfile | null>;

  /**
   * Update a specific path in the spec
   */
  updateSpec(sessionId: number, update: SpecUpdate): Promise<void>;

  /**
   * Update multiple paths at once
   */
  bulkUpdateSpec(sessionId: number, updates: SpecUpdate[]): Promise<void>;

  /**
   * Get value at a specific path
   */
  getValueAtPath(sessionId: number, path: string): Promise<unknown>;

  /**
   * Check if a path has been set (not undefined)
   */
  hasValue(sessionId: number, path: string): Promise<boolean>;

  /**
   * Get all changed paths since session start
   */
  getChangedPaths(sessionId: number): Promise<string[]>;

  /**
   * Subscribe to spec changes
   */
  onSpecChange(callback: (event: SpecChangeEvent) => void): () => void;

  /**
   * Save home profile (persists beyond session)
   */
  saveHomeProfile(leadId: number, profile: HomeProfile): Promise<void>;

  /**
   * Merge transcript inferences into spec
   */
  mergeInferences(sessionId: number, inferences: SpecUpdate[]): Promise<void>;

  /**
   * Export spec as JSON
   */
  exportSpec(sessionId: number): Promise<string>;
}

/**
 * Type guard to check if value is a record-like object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Helper to get nested value from object using dot notation
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/** Keys that should never be set via path navigation to prevent prototype pollution */
const FORBIDDEN_KEYS = ['__proto__', 'prototype', 'constructor'];

/**
 * Check if a key is safe for property assignment (not a prototype pollution vector)
 */
function isSafeKey(key: string): boolean {
  return !FORBIDDEN_KEYS.includes(key);
}

/**
 * Helper to set nested value in object using dot notation
 * Uses a safe approach that avoids prototype pollution by reconstructing the object.
 * @throws Error if path contains prototype pollution keys
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  
  // Guard against prototype pollution attacks - validate ALL keys upfront
  for (const key of keys) {
    if (!isSafeKey(key)) {
      throw new Error(`Invalid path: ${path} contains forbidden key '${key}'`);
    }
  }
  
  if (keys.length === 0) return;
  
  if (keys.length === 1) {
    // Direct assignment for single key - safe since we validated above
    obj[keys[0]] = value;
    return;
  }
  
  // For nested paths, work with a safe copy pattern
  // Navigate to the parent and set the final key
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const existing = current[key];
    if (existing === undefined || existing === null || typeof existing !== 'object') {
      // Create a plain object without prototype (safer)
      current[key] = Object.create(null);
    }
    const next = current[key];
    if (typeof next !== 'object' || next === null) {
      throw new Error(`Cannot set nested path ${path}: intermediate value is not an object`);
    }
    current = next as Record<string, unknown>;
  }
  
  // Set the final value
  current[keys[keys.length - 1]] = value;
}

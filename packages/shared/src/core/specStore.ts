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
   * Get home profile for a customer
   */
  getHomeProfile(customerId: number): Promise<HomeProfile | null>;

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
  saveHomeProfile(customerId: number, profile: HomeProfile): Promise<void>;

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
 * Helper to get nested value from object using dot notation
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Helper to set nested value in object using dot notation
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[keys[keys.length - 1]] = value;
}

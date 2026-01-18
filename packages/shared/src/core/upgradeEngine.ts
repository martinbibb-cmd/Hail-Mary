/**
 * UpgradeEngine Interface
 * 
 * Core service for generating upgrade roadmaps.
 * Given HomeProfile + SpecFinal → returns 0-2 / 2-5 / 5-15 year roadmap items.
 */

import type { SystemSpecDraft, ModuleName } from '../types.js';
import type { HomeProfile } from './specStore.js';

/**
 * Time horizon for upgrade recommendations
 */
export type UpgradeHorizon = '0-2' | '2-5' | '5-15';

/**
 * Urgency level for an upgrade item
 */
export type UpgradeUrgency = 'immediate' | 'soon' | 'planned' | 'future';

/**
 * Category of upgrade
 */
export type UpgradeCategory = 
  | 'heating'      // Boiler, heat pump
  | 'hot_water'    // Cylinder, hot water
  | 'controls'     // Smart controls, TRVs
  | 'insulation'   // Loft, cavity, solid wall
  | 'renewables'   // Solar PV, battery
  | 'ev'           // EV charging
  | 'fabric'       // Windows, doors
  | 'electrical'   // Consumer unit, wiring
  | 'safety';      // Gas safety, ventilation

/**
 * Single upgrade recommendation
 */
export interface UpgradeItem {
  /** Unique identifier */
  id: string;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Category of upgrade */
  category: UpgradeCategory;
  /** Module this relates to */
  module: ModuleName;
  /** Recommended time horizon */
  horizon: UpgradeHorizon;
  /** Urgency level */
  urgency: UpgradeUrgency;
  /** Estimated cost range (low) */
  estimatedCostLow?: number;
  /** Estimated cost range (high) */
  estimatedCostHigh?: number;
  /** Potential savings per year */
  annualSavings?: number;
  /** CO2 savings per year (kg) */
  co2SavingsKg?: number;
  /** Grant eligibility (e.g., BUS, ECO4) */
  grantEligibility?: string[];
  /** Prerequisites (other upgrade IDs) */
  prerequisites?: string[];
  /** Reasons why this is recommended */
  rationale: string[];
  /** Confidence score 0-100 */
  confidence: number;
  /** Priority score for sorting */
  priorityScore: number;
}

/**
 * Complete upgrade roadmap
 */
export interface UpgradeRoadmap {
  /** Customer/session reference */
  sessionId: number;
  /** Generated timestamp */
  generatedAt: Date;
  /** Items for 0-2 year horizon */
  immediate: UpgradeItem[];
  /** Items for 2-5 year horizon */
  nearTerm: UpgradeItem[];
  /** Items for 5-15 year horizon */
  longTerm: UpgradeItem[];
  /** Overall summary text */
  summary: string;
  /** Key insights */
  insights: string[];
  /** Total estimated investment over all horizons */
  totalEstimatedInvestment: {
    low: number;
    high: number;
  };
  /** Total estimated annual savings */
  totalAnnualSavings: number;
  /** Estimated payback period (years) */
  estimatedPaybackYears?: number;
}

/**
 * Configuration for roadmap generation
 */
export interface RoadmapConfig {
  /** Include cost estimates */
  includeCosts?: boolean;
  /** Include grant information */
  includeGrants?: boolean;
  /** Focus modules (empty = all) */
  focusModules?: ModuleName[];
  /** Customer budget preference */
  budgetPreference?: 'economy' | 'balanced' | 'premium';
  /** Customer priority */
  customerPriority?: 'cost_savings' | 'carbon' | 'comfort' | 'reliability';
}

/**
 * UpgradeEngine interface - generates roadmaps
 */
export interface IUpgradeEngine {
  /**
   * Generate a complete upgrade roadmap
   */
  generateRoadmap(
    homeProfile: HomeProfile,
    spec: SystemSpecDraft,
    config?: RoadmapConfig
  ): Promise<UpgradeRoadmap>;

  /**
   * Get quick recommendations (just for one module)
   */
  getQuickRecommendations(
    homeProfile: HomeProfile,
    spec: SystemSpecDraft,
    module: ModuleName
  ): Promise<UpgradeItem[]>;

  /**
   * Check if boiler replacement is imminent
   */
  isBoilerReplacementImminent(spec: SystemSpecDraft): boolean;

  /**
   * Calculate HP suitability score (0-100)
   */
  calculateHeatPumpSuitability(
    homeProfile: HomeProfile,
    spec: SystemSpecDraft
  ): Promise<number>;

  /**
   * Get grant eligibility for upgrades
   */
  getGrantEligibility(
    homeProfile: HomeProfile,
    spec: SystemSpecDraft
  ): Promise<string[]>;

  /**
   * Estimate ROI for a specific upgrade
   */
  estimateROI(
    upgrade: UpgradeItem,
    homeProfile: HomeProfile,
    spec: SystemSpecDraft
  ): Promise<{
    paybackYears: number;
    lifetimeSavings: number;
    netPresentValue: number;
  }>;
}

/**
 * Default roadmap configuration
 */
export const defaultRoadmapConfig: RoadmapConfig = {
  includeCosts: true,
  includeGrants: true,
  focusModules: [],
  budgetPreference: 'balanced',
  customerPriority: 'cost_savings',
};

/**
 * Boiler age thresholds for recommendations
 */
export const BOILER_AGE_THRESHOLDS = {
  /** Age at which to recommend monitoring */
  monitoring: 10,
  /** Age at which to recommend planning replacement */
  planning: 15,
  /** Age at which to recommend urgent replacement */
  urgent: 20,
} as const;

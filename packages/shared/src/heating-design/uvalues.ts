/**
 * U-Value Database for UK Building Construction Types
 * Based on BR 443 (Conventions for U-value calculations) and typical UK construction
 */

import { UValueData, WallConstruction, RoofConstruction, FloorConstruction } from './types.js';

// Define our own GlazingType for heating design U-values
type HeatingGlazingType = 'single' | 'double' | 'double_low_e' | 'triple';

// ============================================================================
// Wall Constructions
// ============================================================================

export const wallConstructions: Record<WallConstruction, UValueData> = {
  solid_brick_uninsulated: {
    uValue: 2.1,
    description: 'Solid brick (215mm), no insulation, pre-1920s',
  },
  solid_brick_internal_insulation: {
    uValue: 0.45,
    description: 'Solid brick with 50mm internal insulation',
  },
  cavity_uninsulated: {
    uValue: 1.6,
    description: 'Cavity wall, no fill, 1920s-1980s',
  },
  cavity_partial_fill: {
    uValue: 0.6,
    description: 'Cavity wall, partial fill insulation',
  },
  cavity_full_fill: {
    uValue: 0.35,
    description: 'Cavity wall, full fill insulation',
  },
  modern_insulated: {
    uValue: 0.18,
    description: 'Modern cavity with 100mm+ insulation (post-2006)',
  },
  timber_frame: {
    uValue: 0.25,
    description: 'Timber frame with insulation',
  },
};

// ============================================================================
// Roof Constructions
// ============================================================================

export const roofConstructions: Record<RoofConstruction, UValueData> = {
  uninsulated: {
    uValue: 2.3,
    description: 'Pitched roof, no insulation',
  },
  loft_insulation_100mm: {
    uValue: 0.4,
    description: 'Pitched roof with 100mm loft insulation',
  },
  loft_insulation_270mm: {
    uValue: 0.16,
    description: 'Pitched roof with 270mm loft insulation (current regulations)',
  },
  warm_roof: {
    uValue: 0.18,
    description: 'Warm roof construction with insulation above rafters',
  },
  flat_roof_insulated: {
    uValue: 0.25,
    description: 'Flat roof with insulation',
  },
};

// ============================================================================
// Floor Constructions
// ============================================================================

export const floorConstructions: Record<FloorConstruction, UValueData> = {
  solid_uninsulated: {
    uValue: 0.7,
    description: 'Solid concrete floor, no insulation',
  },
  solid_insulated: {
    uValue: 0.25,
    description: 'Solid floor with insulation (post-2002)',
  },
  suspended_timber_uninsulated: {
    uValue: 0.9,
    description: 'Suspended timber floor, no insulation',
  },
  suspended_timber_insulated: {
    uValue: 0.25,
    description: 'Suspended timber floor with insulation',
  },
  beam_block: {
    uValue: 0.22,
    description: 'Beam and block floor with insulation',
  },
};

// ============================================================================
// Glazing Types
// ============================================================================

export const glazingTypes: Record<HeatingGlazingType, UValueData> = {
  single: {
    uValue: 4.8,
    description: 'Single glazed',
  },
  double: {
    uValue: 2.8,
    description: 'Standard double glazed',
  },
  double_low_e: {
    uValue: 1.8,
    description: 'Double glazed with low-E coating',
  },
  triple: {
    uValue: 1.2,
    description: 'Triple glazed',
  },
};

// ============================================================================
// Door U-Values
// ============================================================================

export const doorUValues = {
  solid_timber: {
    uValue: 3.0,
    description: 'Solid timber door',
  },
  semi_glazed: {
    uValue: 3.5,
    description: 'Door with partial glazing',
  },
  insulated: {
    uValue: 2.0,
    description: 'Insulated door',
  },
  upvc: {
    uValue: 1.8,
    description: 'uPVC door with double glazing',
  },
};

// ============================================================================
// Default Target Temperatures by Room Type (°C)
// ============================================================================

export const defaultTargetTemperatures = {
  living_room: 21,
  dining_room: 21,
  kitchen: 18,
  bedroom: 18,
  bathroom: 22,
  hallway: 18,
  study: 20,
  utility: 16,
  conservatory: 18,
  garage: 10,
  other: 18,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getWallUValue(construction: WallConstruction): number {
  return wallConstructions[construction].uValue;
}

export function getRoofUValue(construction: RoofConstruction): number {
  return roofConstructions[construction].uValue;
}

export function getFloorUValue(construction: FloorConstruction): number {
  return floorConstructions[construction].uValue;
}

export function getGlazingUValue(glazingType: HeatingGlazingType): number {
  return glazingTypes[glazingType].uValue;
}

export function getTargetTemperature(roomType: string): number {
  return defaultTargetTemperatures[roomType as keyof typeof defaultTargetTemperatures] || 18;
}

// ============================================================================
// Thermal Bridging Y-values (W/m²K)
// ============================================================================

export const thermalBridging = {
  // These are added to the U-value to account for heat loss at junctions
  default: 0.15, // Typical for mixed construction
  good_design: 0.08, // Well-designed details
  poor_construction: 0.25, // Older buildings with significant bridging
  passivhaus: 0.03, // Minimal thermal bridging
};

// ============================================================================
// Air Change Rates (ACH)
// ============================================================================

export const airChangeRates = {
  // Air changes per hour by building age/quality
  modern_airtight: 0.5, // Post-2010 with good airtightness
  modern_standard: 1.0, // Post-2000 standard build
  older_renovated: 1.5, // Older building, renovated
  older_poor: 2.5, // Older building, drafty
  victorian: 3.0, // Victorian/pre-1920s
};

// ============================================================================
// Climate Data by UK Region
// ============================================================================

export const ukClimateData = {
  'South East': {
    outsideDesignTemp: -2,
    windSpeed: 4.5,
    description: 'Mildest region',
  },
  'South West': {
    outsideDesignTemp: -1,
    windSpeed: 5.0,
    description: 'Mild, coastal influence',
  },
  'East Anglia': {
    outsideDesignTemp: -3,
    windSpeed: 5.5,
    description: 'Cold winters, exposed',
  },
  'Midlands': {
    outsideDesignTemp: -3,
    windSpeed: 4.0,
    description: 'Continental climate',
  },
  'North West': {
    outsideDesignTemp: -3,
    windSpeed: 5.5,
    description: 'Maritime climate',
  },
  'North East': {
    outsideDesignTemp: -4,
    windSpeed: 5.0,
    description: 'Cold winters',
  },
  'Yorkshire': {
    outsideDesignTemp: -4,
    windSpeed: 5.5,
    description: 'Cold, exposed',
  },
  'Wales': {
    outsideDesignTemp: -2,
    windSpeed: 6.0,
    description: 'Maritime, windy',
  },
  'Scotland': {
    outsideDesignTemp: -5,
    windSpeed: 6.5,
    description: 'Cold winters, exposed',
  },
  'Northern Ireland': {
    outsideDesignTemp: -3,
    windSpeed: 5.5,
    description: 'Maritime climate',
  },
};

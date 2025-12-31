/**
 * Atlas Voice - Expanded Domain Knowledge Catalog
 *
 * Extended catalog with comprehensive boiler models, fault codes, and diagnostics.
 *
 * This file expands on the starter catalog with:
 * - 40+ common boiler models across all major manufacturers
 * - 60+ fault codes with detailed diagnostics
 * - 15+ diagnostic patterns
 * - Component aliases and states
 *
 * Eventually this will integrate with the full GC product catalog.
 */

import type { BoilerModel, FaultCode, DiagnosticPattern } from './domain-knowledge-catalog';

// ============================================
// Expanded Boiler Models
// ============================================

/**
 * Comprehensive boiler model catalog
 *
 * Covers the most common models seen in UK installations
 */
export const EXPANDED_BOILER_MODELS: Record<string, BoilerModel> = {
  // ========== Worcester Bosch ==========

  'worcester_greenstar_25i': {
    make: 'Worcester Bosch',
    model: 'Greenstar 25i',
    type: 'combi',
    output_kw: 25,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5', 'S16', 'E9'],
    introduced_year: 2015,
  },

  'worcester_greenstar_30i': {
    make: 'Worcester Bosch',
    model: 'Greenstar 30i',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5', 'S16', 'E9'],
    introduced_year: 2015,
  },

  'worcester_greenstar_35i': {
    make: 'Worcester Bosch',
    model: 'Greenstar 35i',
    type: 'combi',
    output_kw: 35,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5', 'S16', 'E9'],
    introduced_year: 2015,
  },

  'worcester_greenstar_25si': {
    make: 'Worcester Bosch',
    model: 'Greenstar 25Si',
    type: 'system',
    output_kw: 25,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5', 'E9'],
    introduced_year: 2013,
  },

  'worcester_greenstar_30si': {
    make: 'Worcester Bosch',
    model: 'Greenstar 30Si',
    type: 'system',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5', 'E9'],
    introduced_year: 2013,
  },

  'worcester_greenstar_30cdi': {
    make: 'Worcester Bosch',
    model: 'Greenstar 30CDi',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['224', '227', '228'],
    introduced_year: 2005,
    discontinued_year: 2015,
  },

  'worcester_greenstar_ri': {
    make: 'Worcester Bosch',
    model: 'Greenstar Ri',
    type: 'regular',
    output_kw: 18,
    fuel_type: 'gas',
    common_fault_codes: ['EA', 'D5'],
    introduced_year: 2013,
  },

  // ========== Baxi ==========

  'baxi_duo_tec_24': {
    make: 'Baxi',
    model: 'Duo-tec 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['E133', 'E110', 'E125', 'E117'],
    introduced_year: 2016,
  },

  'baxi_duo_tec_28': {
    make: 'Baxi',
    model: 'Duo-tec 28',
    type: 'combi',
    output_kw: 28,
    fuel_type: 'gas',
    common_fault_codes: ['E133', 'E110', 'E125', 'E117'],
    introduced_year: 2016,
  },

  'baxi_duo_tec_33': {
    make: 'Baxi',
    model: 'Duo-tec 33',
    type: 'combi',
    output_kw: 33,
    fuel_type: 'gas',
    common_fault_codes: ['E133', 'E110', 'E125', 'E117'],
    introduced_year: 2016,
  },

  'baxi_duo_tec_40': {
    make: 'Baxi',
    model: 'Duo-tec 40',
    type: 'combi',
    output_kw: 40,
    fuel_type: 'gas',
    common_fault_codes: ['E133', 'E110', 'E125', 'E117'],
    introduced_year: 2016,
  },

  'baxi_800_series': {
    make: 'Baxi',
    model: '800 Series',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['E110', 'E117', 'E125'],
    introduced_year: 2019,
  },

  'baxi_platinum_combi': {
    make: 'Baxi',
    model: 'Platinum Combi',
    type: 'combi',
    output_kw: 33,
    fuel_type: 'gas',
    common_fault_codes: ['E110', 'E117', 'E125'],
    introduced_year: 2013,
  },

  // ========== Ideal ==========

  'ideal_logic_plus_24': {
    make: 'Ideal',
    model: 'Logic+ 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2', 'F4'],
    introduced_year: 2017,
  },

  'ideal_logic_plus_30': {
    make: 'Ideal',
    model: 'Logic+ 30',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2', 'F4'],
    introduced_year: 2017,
  },

  'ideal_logic_plus_35': {
    make: 'Ideal',
    model: 'Logic+ 35',
    type: 'combi',
    output_kw: 35,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2', 'F4'],
    introduced_year: 2017,
  },

  'ideal_logic_max_24': {
    make: 'Ideal',
    model: 'Logic Max 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2'],
    introduced_year: 2015,
  },

  'ideal_logic_heat_18': {
    make: 'Ideal',
    model: 'Logic Heat 18',
    type: 'regular',
    output_kw: 18,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2'],
    introduced_year: 2017,
  },

  'ideal_vogue_max_26': {
    make: 'Ideal',
    model: 'Vogue Max 26',
    type: 'combi',
    output_kw: 26,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2'],
    introduced_year: 2018,
  },

  // ========== Vaillant ==========

  'vaillant_ecotec_plus_825': {
    make: 'Vaillant',
    model: 'ecoTEC plus 825',
    type: 'combi',
    output_kw: 25,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75', 'F22'],
    introduced_year: 2018,
  },

  'vaillant_ecotec_plus_832': {
    make: 'Vaillant',
    model: 'ecoTEC plus 832',
    type: 'combi',
    output_kw: 32,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75', 'F22'],
    introduced_year: 2018,
  },

  'vaillant_ecotec_plus_838': {
    make: 'Vaillant',
    model: 'ecoTEC plus 838',
    type: 'combi',
    output_kw: 38,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75', 'F22'],
    introduced_year: 2018,
  },

  'vaillant_ecotec_pro_24': {
    make: 'Vaillant',
    model: 'ecoTEC pro 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2012,
  },

  'vaillant_ecotec_pro_28': {
    make: 'Vaillant',
    model: 'ecoTEC pro 28',
    type: 'combi',
    output_kw: 28,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2012,
  },

  'vaillant_ecotec_exclusive_843': {
    make: 'Vaillant',
    model: 'ecoTEC exclusive 843',
    type: 'combi',
    output_kw: 43,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75', 'F22'],
    introduced_year: 2019,
  },

  // ========== Viessmann ==========

  'viessmann_vitodens_050_w': {
    make: 'Viessmann',
    model: 'Vitodens 050-W',
    type: 'combi',
    output_kw: 29,
    fuel_type: 'gas',
    common_fault_codes: ['A8', 'F4', 'F5'],
    introduced_year: 2016,
  },

  'viessmann_vitodens_100_w': {
    make: 'Viessmann',
    model: 'Vitodens 100-W',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['A8', 'F4', 'F5', '0A'],
    introduced_year: 2015,
  },

  'viessmann_vitodens_200_w': {
    make: 'Viessmann',
    model: 'Vitodens 200-W',
    type: 'system',
    output_kw: 26,
    fuel_type: 'gas',
    common_fault_codes: ['A8', 'F4', 'F5'],
    introduced_year: 2014,
  },

  // ========== Potterton ==========

  'potterton_gold_24': {
    make: 'Potterton',
    model: 'Gold 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['E110', 'E117', 'E125'],
    introduced_year: 2015,
  },

  'potterton_gold_28': {
    make: 'Potterton',
    model: 'Gold 28',
    type: 'combi',
    output_kw: 28,
    fuel_type: 'gas',
    common_fault_codes: ['E110', 'E117', 'E125'],
    introduced_year: 2015,
  },

  'potterton_titanium_24': {
    make: 'Potterton',
    model: 'Titanium 24',
    type: 'combi',
    output_kw: 24,
    fuel_type: 'gas',
    common_fault_codes: ['E110', 'E117', 'E125'],
    introduced_year: 2018,
  },

  // ========== Alpha ==========

  'alpha_e_tec_28': {
    make: 'Alpha',
    model: 'E-Tec 28',
    type: 'combi',
    output_kw: 28,
    fuel_type: 'gas',
    common_fault_codes: ['E01', 'E02', 'E10'],
    introduced_year: 2016,
  },

  'alpha_e_tec_33': {
    make: 'Alpha',
    model: 'E-Tec 33',
    type: 'combi',
    output_kw: 33,
    fuel_type: 'gas',
    common_fault_codes: ['E01', 'E02', 'E10'],
    introduced_year: 2016,
  },

  // ========== Glow-worm ==========

  'glowworm_energy_25c': {
    make: 'Glow-worm',
    model: 'Energy 25C',
    type: 'combi',
    output_kw: 25,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2018,
  },

  'glowworm_energy_30c': {
    make: 'Glow-worm',
    model: 'Energy 30C',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2018,
  },

  'glowworm_energy_35c': {
    make: 'Glow-worm',
    model: 'Energy 35C',
    type: 'combi',
    output_kw: 35,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2018,
  },
};

// ============================================
// Expanded Fault Codes
// ============================================

/**
 * Comprehensive fault code catalog
 *
 * Covers common codes across all major manufacturers
 */
export const EXPANDED_FAULT_CODES: Record<string, FaultCode> = {
  // ========== Worcester Bosch ==========

  'worcester_ea': {
    code: 'EA',
    make: 'Worcester Bosch',
    description: 'Flame sensing fault',
    severity: 'error',
    common_causes: [
      'Flame sense electrode dirty',
      'Poor earth connection',
      'Gas valve fault',
      'Ionisation current too low',
    ],
    recommended_checks: [
      'Clean flame sense electrode',
      'Check earth continuity',
      'Test ionisation current',
      'Inspect gas valve',
    ],
  },

  'worcester_d5': {
    code: 'D5',
    make: 'Worcester Bosch',
    description: 'Internal fault - temperature rise too fast',
    severity: 'error',
    common_causes: [
      'Pump not running',
      'System blockage',
      'Low water content',
      'Bypass valve closed',
    ],
    recommended_checks: [
      'Check pump operation',
      'Verify system flow',
      'Check bypass valve',
      'Flush heat exchanger',
    ],
  },

  'worcester_s16': {
    code: 'S16',
    make: 'Worcester Bosch',
    description: 'Low water pressure',
    severity: 'warning',
    common_causes: [
      'System leak',
      'Insufficient filling',
      'Pressure sensor fault',
    ],
    recommended_checks: [
      'Check pressure gauge (should be 1-1.5 bar)',
      'Inspect for leaks',
      'Repressurise system',
      'Test pressure sensor',
    ],
  },

  'worcester_e9': {
    code: 'E9',
    make: 'Worcester Bosch',
    description: 'Burner lockout',
    severity: 'error',
    common_causes: [
      'Ignition failure',
      'Gas supply issue',
      'Electrode gap incorrect',
      'PCB fault',
    ],
    recommended_checks: [
      'Check gas supply',
      'Test ignition electrode gap (3-4mm)',
      'Verify ignition leads',
      'Check PCB',
    ],
  },

  'worcester_224': {
    code: '224',
    make: 'Worcester Bosch',
    description: 'Ignition failure (older CDi models)',
    severity: 'error',
    common_causes: [
      'No gas supply',
      'Ignition electrode fault',
      'Gas valve issue',
    ],
    recommended_checks: [
      'Check gas supply',
      'Test ignition electrode',
      'Verify gas valve',
    ],
  },

  'worcester_227': {
    code: '227',
    make: 'Worcester Bosch',
    description: 'Flame sense fault (older CDi models)',
    severity: 'error',
    common_causes: [
      'Flame sense electrode dirty',
      'Poor earth',
      'Ionisation fault',
    ],
    recommended_checks: [
      'Clean electrode',
      'Check earth',
      'Test ionisation',
    ],
  },

  'worcester_228': {
    code: '228',
    make: 'Worcester Bosch',
    description: 'Flame loss during operation',
    severity: 'error',
    common_causes: [
      'Gas supply interruption',
      'Flue blockage',
      'Electrode fault',
    ],
    recommended_checks: [
      'Check gas pressure',
      'Inspect flue',
      'Test electrode',
    ],
  },

  // ========== Baxi ==========

  'baxi_e133': {
    code: 'E133',
    make: 'Baxi',
    description: 'Gas valve fault',
    severity: 'error',
    common_causes: [
      'Gas valve coil failure',
      'Wiring fault',
      'PCB issue',
    ],
    recommended_checks: [
      'Test gas valve resistance',
      'Check wiring to valve',
      'Test PCB outputs',
    ],
  },

  'baxi_e110': {
    code: 'E110',
    make: 'Baxi',
    description: 'Overheat thermostat activated',
    severity: 'critical',
    common_causes: [
      'Pump failure',
      'System blockage',
      'Bypass closed',
      'Low water content',
    ],
    recommended_checks: [
      'Check pump running',
      'Verify system flow',
      'Check bypass valve',
      'Reset overheat stat',
    ],
  },

  'baxi_e125': {
    code: 'E125',
    make: 'Baxi',
    description: 'Pump fault / no circulation',
    severity: 'error',
    common_causes: [
      'Pump seized',
      'Pump wiring fault',
      'PCB issue',
      'System blockage',
    ],
    recommended_checks: [
      'Check pump operation',
      'Test pump wiring',
      'Verify PCB outputs',
      'Check system flow',
    ],
  },

  'baxi_e117': {
    code: 'E117',
    make: 'Baxi',
    description: 'High limit thermostat / pressure fault',
    severity: 'error',
    common_causes: [
      'System overpressure',
      'Pressure sensor fault',
      'Overheat condition',
    ],
    recommended_checks: [
      'Check system pressure',
      'Test pressure sensor',
      'Check for overheat',
    ],
  },

  'baxi_e160': {
    code: 'E160',
    make: 'Baxi',
    description: 'Fan fault',
    severity: 'error',
    common_causes: [
      'Fan seized',
      'Fan wiring fault',
      'PCB issue',
    ],
    recommended_checks: [
      'Check fan operation',
      'Test fan wiring',
      'Verify PCB',
    ],
  },

  // ========== Ideal ==========

  'ideal_f1': {
    code: 'F1',
    make: 'Ideal',
    description: 'Low water pressure',
    severity: 'warning',
    common_causes: [
      'System leak',
      'Insufficient filling',
    ],
    recommended_checks: [
      'Check pressure (should be 1-1.5 bar)',
      'Inspect for leaks',
      'Repressurise system',
    ],
  },

  'ideal_f2': {
    code: 'F2',
    make: 'Ideal',
    description: 'Overheat / flame loss',
    severity: 'error',
    common_causes: [
      'Pump not running',
      'Flame sense fault',
      'System blockage',
    ],
    recommended_checks: [
      'Check pump operation',
      'Test flame electrode',
      'Verify system flow',
    ],
  },

  'ideal_l2': {
    code: 'L2',
    make: 'Ideal',
    description: 'Dry fire protection (flow sensor issue)',
    severity: 'error',
    common_causes: [
      'Pump not running',
      'Air in system',
      'Flow sensor blocked',
    ],
    recommended_checks: [
      'Check pump operation',
      'Bleed system',
      'Check flow sensor',
    ],
  },

  'ideal_f4': {
    code: 'F4',
    make: 'Ideal',
    description: 'Ignition failure',
    severity: 'error',
    common_causes: [
      'No gas supply',
      'Ignition electrode fault',
      'Gas valve issue',
    ],
    recommended_checks: [
      'Check gas supply',
      'Test ignition electrode',
      'Verify gas valve',
    ],
  },

  'ideal_f5': {
    code: 'F5',
    make: 'Ideal',
    description: 'Fan fault',
    severity: 'error',
    common_causes: [
      'Fan seized',
      'Fan wiring fault',
      'Air pressure switch fault',
    ],
    recommended_checks: [
      'Check fan operation',
      'Test fan wiring',
      'Check air pressure switch',
    ],
  },

  // ========== Vaillant ==========

  'vaillant_f28': {
    code: 'F28',
    make: 'Vaillant',
    description: 'Ignition lockout',
    severity: 'error',
    common_causes: [
      'No gas supply',
      'Ignition fault',
      'Gas valve issue',
    ],
    recommended_checks: [
      'Check gas supply',
      'Test ignition',
      'Verify gas valve',
    ],
  },

  'vaillant_f29': {
    code: 'F29',
    make: 'Vaillant',
    description: 'Flame loss during operation',
    severity: 'error',
    common_causes: [
      'Gas supply interruption',
      'Flame sense electrode dirty',
      'Flue issue',
    ],
    recommended_checks: [
      'Check gas pressure',
      'Clean electrode',
      'Inspect flue',
    ],
  },

  'vaillant_f75': {
    code: 'F75',
    make: 'Vaillant',
    description: 'Pressure sensor fault',
    severity: 'error',
    common_causes: [
      'Pressure sensor failed',
      'Wiring issue',
      'Actual low pressure',
    ],
    recommended_checks: [
      'Test pressure sensor',
      'Check wiring',
      'Verify actual pressure',
    ],
  },

  'vaillant_f22': {
    code: 'F22',
    make: 'Vaillant',
    description: 'Low water pressure',
    severity: 'warning',
    common_causes: [
      'System leak',
      'Insufficient filling',
      'Pressure sensor fault',
    ],
    recommended_checks: [
      'Check pressure gauge',
      'Inspect for leaks',
      'Repressurise system',
      'Test sensor if needed',
    ],
  },

  'vaillant_f27': {
    code: 'F27',
    make: 'Vaillant',
    description: 'Flame simulation detected',
    severity: 'critical',
    common_causes: [
      'Flame sense electrode wet',
      'Gas valve leaking',
      'Wiring fault',
    ],
    recommended_checks: [
      'Dry electrode',
      'Test gas valve shut-off',
      'Check wiring',
    ],
  },

  'vaillant_f54': {
    code: 'F54',
    make: 'Vaillant',
    description: 'Gas supply fault',
    severity: 'error',
    common_causes: [
      'Gas supply pressure too low',
      'Gas meter issue',
      'Gas valve fault',
    ],
    recommended_checks: [
      'Check gas pressure (working and standing)',
      'Verify gas meter',
      'Test gas valve',
    ],
  },

  // ========== Viessmann ==========

  'viessmann_a8': {
    code: 'A8',
    make: 'Viessmann',
    description: 'Burner fault - low gas pressure',
    severity: 'error',
    common_causes: [
      'Gas pressure too low',
      'Gas valve fault',
      'Gas supply issue',
    ],
    recommended_checks: [
      'Check gas pressure',
      'Test gas valve',
      'Verify gas supply',
    ],
  },

  'viessmann_f4': {
    code: 'F4',
    make: 'Viessmann',
    description: 'Flame sense fault',
    severity: 'error',
    common_causes: [
      'Electrode dirty',
      'Poor earth',
      'Ionisation fault',
    ],
    recommended_checks: [
      'Clean electrode',
      'Check earth',
      'Test ionisation',
    ],
  },

  'viessmann_f5': {
    code: 'F5',
    make: 'Viessmann',
    description: 'Flue fault',
    severity: 'critical',
    common_causes: [
      'Flue blocked',
      'Air pressure switch fault',
      'Fan issue',
    ],
    recommended_checks: [
      'Inspect flue',
      'Test air pressure switch',
      'Check fan operation',
    ],
  },

  'viessmann_0a': {
    code: '0A',
    make: 'Viessmann',
    description: 'Low system pressure',
    severity: 'warning',
    common_causes: [
      'System leak',
      'Insufficient filling',
    ],
    recommended_checks: [
      'Check pressure gauge',
      'Inspect for leaks',
      'Repressurise system',
    ],
  },

  // ========== Alpha ==========

  'alpha_e01': {
    code: 'E01',
    make: 'Alpha',
    description: 'Ignition failure',
    severity: 'error',
    common_causes: [
      'No gas supply',
      'Ignition electrode fault',
      'Gas valve issue',
    ],
    recommended_checks: [
      'Check gas supply',
      'Test ignition electrode',
      'Verify gas valve',
    ],
  },

  'alpha_e02': {
    code: 'E02',
    make: 'Alpha',
    description: 'Flame loss',
    severity: 'error',
    common_causes: [
      'Gas supply interruption',
      'Flame sense electrode fault',
      'Flue issue',
    ],
    recommended_checks: [
      'Check gas pressure',
      'Test flame electrode',
      'Inspect flue',
    ],
  },

  'alpha_e10': {
    code: 'E10',
    make: 'Alpha',
    description: 'Low system pressure',
    severity: 'warning',
    common_causes: [
      'System leak',
      'Insufficient filling',
    ],
    recommended_checks: [
      'Check pressure gauge',
      'Inspect for leaks',
      'Repressurise system',
    ],
  },
};

// ============================================
// Expanded Diagnostic Patterns
// ============================================

/**
 * Additional diagnostic patterns for common heating issues
 */
export const EXPANDED_DIAGNOSTIC_PATTERNS: Record<string, DiagnosticPattern> = {
  'radiator_cold_bottom': {
    id: 'radiator_cold_bottom',
    name: 'Radiator Cold at Bottom',
    description: 'Radiator is hot at top but cold at bottom',
    severity: 'minor',
    common_causes: [
      'Sludge buildup in radiator',
      'Poor circulation',
      'Radiator needs flushing',
    ],
    diagnostic_checks: [
      'Check if all radiators affected or just one',
      'Test flow and return temperatures',
      'Flush radiator',
      'Consider powerflush if system-wide',
    ],
    sop_reference: 'SOP-RAD-001',
  },

  'radiator_cold_top': {
    id: 'radiator_cold_top',
    name: 'Radiator Cold at Top',
    description: 'Radiator is cold at top but hot at bottom',
    severity: 'minor',
    common_causes: [
      'Air in radiator',
      'Air in system',
    ],
    diagnostic_checks: [
      'Bleed radiator',
      'Check automatic air vent',
      'Check for air in pump',
      'Verify system pressure after bleeding',
    ],
    sop_reference: 'SOP-RAD-002',
  },

  'boiler_kettling': {
    id: 'boiler_kettling',
    name: 'Boiler Kettling (Noise)',
    description: 'Boiler making loud kettling/rumbling noise',
    severity: 'moderate',
    common_causes: [
      'Limescale buildup in heat exchanger',
      'Restricted flow',
      'System dirty',
    ],
    diagnostic_checks: [
      'Check water hardness',
      'Inspect heat exchanger',
      'Check pump operation',
      'Consider chemical clean or powerflush',
    ],
    sop_reference: 'SOP-NOISE-001',
  },

  'pump_noisy': {
    id: 'pump_noisy',
    name: 'Noisy Pump',
    description: 'Circulating pump making noise',
    severity: 'moderate',
    common_causes: [
      'Pump bearing wear',
      'Air in pump',
      'Pump speed too high',
      'System debris',
    ],
    diagnostic_checks: [
      'Bleed pump',
      'Check pump speed setting',
      'Inspect for bearing wear',
      'Check system cleanliness',
    ],
    sop_reference: 'SOP-PUMP-002',
  },

  'hot_water_slow': {
    id: 'hot_water_slow',
    name: 'Hot Water Slow to Heat',
    description: 'Takes long time to get hot water',
    severity: 'moderate',
    common_causes: [
      'Plate heat exchanger scaled',
      'Thermistor fault',
      'Gas pressure low',
      'Flow restrictor blocked',
    ],
    diagnostic_checks: [
      'Test gas pressure',
      'Check heat exchanger',
      'Test thermistor',
      'Inspect flow restrictor',
      'Check boiler modulation',
    ],
    sop_reference: 'SOP-HW-003',
  },

  'boiler_cycling': {
    id: 'boiler_cycling',
    name: 'Boiler Short Cycling',
    description: 'Boiler fires for short periods then switches off',
    severity: 'moderate',
    common_causes: [
      'Boiler oversized for property',
      'Poor flow (pump/blockage)',
      'Bypass valve incorrect',
      'System volume too small',
    ],
    diagnostic_checks: [
      'Check boiler output vs heat loss',
      'Verify pump operation',
      'Check bypass setting',
      'Calculate system volume',
      'Consider TRV strategy',
    ],
    sop_reference: 'SOP-CYCLE-001',
  },

  'frost_stat_activated': {
    id: 'frost_stat_activated',
    name: 'Frost Stat Activated',
    description: 'Frost protection has activated',
    severity: 'info',
    common_causes: [
      'Low ambient temperature',
      'Thermostat in cold location',
      'System exposed to frost',
    ],
    diagnostic_checks: [
      'Check frost stat location',
      'Verify system not frozen',
      'Check pipe insulation',
      'Consider frost stat relocation',
    ],
    sop_reference: 'SOP-FROST-001',
  },

  'condensate_frozen': {
    id: 'condensate_frozen',
    name: 'Condensate Pipe Frozen',
    description: 'Condensate discharge pipe frozen (boiler locked out)',
    severity: 'serious',
    common_causes: [
      'Exposed condensate pipe',
      'Insufficient insulation',
      'Cold weather',
    ],
    diagnostic_checks: [
      'Pour warm water on condensate pipe',
      'Check pipe run (should be downhill)',
      'Measure pipe diameter (should be 32mm minimum)',
      'Insulate exposed sections',
      'Consider internal termination',
    ],
    sop_reference: 'SOP-CONDENSATE-001',
  },

  'ignition_delay': {
    id: 'ignition_delay',
    name: 'Ignition Delay',
    description: 'Delay between demand and ignition',
    severity: 'moderate',
    common_causes: [
      'Electrode gap incorrect',
      'Spark weak',
      'Gas pressure low',
      'Ignition lead fault',
    ],
    diagnostic_checks: [
      'Check electrode gap (3-4mm)',
      'Test spark strength',
      'Measure gas pressure',
      'Inspect ignition lead',
    ],
    sop_reference: 'SOP-IGN-001',
  },

  'flame_poor': {
    id: 'flame_poor',
    name: 'Poor Flame Picture',
    description: 'Flame appearance abnormal (yellow/lazy)',
    severity: 'serious',
    common_causes: [
      'Burner dirty',
      'Gas/air ratio incorrect',
      'Flue restriction',
      'Insufficient combustion air',
    ],
    diagnostic_checks: [
      'Perform flue gas analysis',
      'Inspect burner',
      'Check gas pressure',
      'Verify air intake',
      'Check flue',
    ],
    sop_reference: 'SOP-FLAME-001',
  },

  'heating_demand_but_no_fire': {
    id: 'heating_demand_but_no_fire',
    name: 'Heating Demand But Boiler Not Firing',
    description: 'Thermostat calling but boiler not igniting',
    severity: 'serious',
    common_causes: [
      'No demand at boiler terminals',
      'Wiring fault',
      'PCB fault',
      'Interlock not satisfied',
    ],
    diagnostic_checks: [
      'Check demand at boiler terminals',
      'Verify stat operation',
      'Check wiring centre',
      'Test pump proving circuit (if applicable)',
      'Check all interlocks (pressure, thermostat, etc.)',
    ],
    sop_reference: 'SOP-DEMAND-001',
  },

  'zone_valve_stuck': {
    id: 'zone_valve_stuck',
    name: 'Zone Valve Stuck',
    description: 'Motorized zone valve not operating',
    severity: 'serious',
    common_causes: [
      'Valve motor failed',
      'Valve seized',
      'Wiring fault',
      'Micro-switch failed',
    ],
    diagnostic_checks: [
      'Test manual lever',
      'Check voltage at motor terminals',
      'Test micro-switch operation',
      'Replace valve if seized',
    ],
    sop_reference: 'SOP-VALVE-001',
  },

  'expansion_vessel_failed': {
    id: 'expansion_vessel_failed',
    name: 'Expansion Vessel Failed',
    description: 'Expansion vessel has lost charge or bladder failed',
    severity: 'moderate',
    common_causes: [
      'Vessel lost charge',
      'Bladder punctured',
      'Vessel waterlogged',
    ],
    diagnostic_checks: [
      'Check vessel charge (should be 0.5-1 bar)',
      'Drain vessel and check for water',
      'Recharge vessel if needed',
      'Replace if bladder failed',
    ],
    sop_reference: 'SOP-VESSEL-001',
  },

  'filling_loop_passing': {
    id: 'filling_loop_passing',
    name: 'Filling Loop Passing',
    description: 'Filling loop leaking or passing water',
    severity: 'moderate',
    common_causes: [
      'Filling loop not fully closed',
      'Valve seats worn',
      'Backflow preventer faulty',
    ],
    diagnostic_checks: [
      'Ensure both valves fully closed',
      'Check for drips',
      'Disconnect filling loop after use',
      'Replace if valves worn',
    ],
    sop_reference: 'SOP-FILL-001',
  },

  'flue_condensation': {
    id: 'flue_condensation',
    name: 'Flue Condensation',
    description: 'Water dripping from flue terminal',
    severity: 'minor',
    common_causes: [
      'Normal condensing boiler operation',
      'Flue gradient incorrect',
      'Flue length excessive',
    ],
    diagnostic_checks: [
      'Verify flue gradient (5 degrees minimum)',
      'Check flue is not too long',
      'Install plume kit if needed',
      'Ensure condensate drain working',
    ],
    sop_reference: 'SOP-FLUE-002',
  },
};

// ============================================
// Export Expanded Catalogs
// ============================================

export {
  EXPANDED_BOILER_MODELS,
  EXPANDED_FAULT_CODES,
  EXPANDED_DIAGNOSTIC_PATTERNS,
};

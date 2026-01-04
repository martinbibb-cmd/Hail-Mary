/**
 * Atlas Voice - Domain Knowledge Catalog
 *
 * This is the "enrichment loop" that makes Atlas understand heating engineering language.
 *
 * Contains:
 * - Boiler aliases and models
 * - Control system patterns
 * - Diagnostic event patterns
 * - Common engineering jargon normalization
 *
 * These catalogs are used by Rocky v2 for:
 * - Alias resolution ("backsy" → "Baxi")
 * - Entity validation (is "S16" a valid code?)
 * - Confidence boosting (exact catalog match = higher confidence)
 * - Suggestion generation (what checks for "PRV passing"?)
 */

// ============================================
// Boiler Catalog
// ============================================

/**
 * Common boiler make aliases
 *
 * Engineers speak casually: "backsy", "wurster", "vailant"
 * Atlas needs to normalize to: "Baxi", "Worcester Bosch", "Vaillant"
 */
export const BOILER_MAKE_ALIASES: Record<string, string> = {
  // Worcester Bosch
  'worcester': 'Worcester Bosch',
  'wurster': 'Worcester Bosch',
  'worcester bosch': 'Worcester Bosch',
  'worc': 'Worcester Bosch',

  // Baxi
  'baxi': 'Baxi',
  'backsy': 'Baxi',
  'backsee': 'Baxi',

  // Vaillant
  'vaillant': 'Vaillant',
  'vailant': 'Vaillant',
  'valiant': 'Vaillant',

  // Ideal
  'ideal': 'Ideal',
  'ideal logic': 'Ideal',

  // Viessmann
  'viessmann': 'Viessmann',
  'viesman': 'Viessmann',
  'viessman': 'Viessmann',

  // Potterton
  'potterton': 'Potterton',
  'potter': 'Potterton',

  // Glow-worm
  'glow-worm': 'Glow-worm',
  'glowworm': 'Glow-worm',
  'glow worm': 'Glow-worm',

  // Alpha
  'alpha': 'Alpha',

  // Ariston
  'ariston': 'Ariston',

  // Ferroli
  'ferroli': 'Ferroli',

  // Main
  'main': 'Main',

  // Keston
  'keston': 'Keston',
};

/**
 * Common boiler models with metadata
 *
 * This is a starter set. Eventually integrate with GC catalog for full coverage.
 */
export interface BoilerModel {
  make: string;
  model: string;
  type: 'combi' | 'system' | 'regular';
  output_kw: number;
  fuel_type: 'gas' | 'oil' | 'lpg';
  common_fault_codes: string[];
  introduced_year?: number;
  discontinued_year?: number;
}

export const COMMON_BOILER_MODELS: Record<string, BoilerModel> = {
  'worcester_greenstar_30i': {
    make: 'Worcester Bosch',
    model: 'Greenstar 30i',
    type: 'combi',
    output_kw: 30,
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

  'baxi_duo_tec_33': {
    make: 'Baxi',
    model: 'Duo-tec 33',
    type: 'combi',
    output_kw: 33,
    fuel_type: 'gas',
    common_fault_codes: ['E133', 'E110', 'E125'],
    introduced_year: 2016,
  },

  'ideal_logic_30': {
    make: 'Ideal',
    model: 'Logic+ 30',
    type: 'combi',
    output_kw: 30,
    fuel_type: 'gas',
    common_fault_codes: ['F1', 'F2', 'L2'],
    introduced_year: 2017,
  },

  'vaillant_ecotec_plus_832': {
    make: 'Vaillant',
    model: 'ecoTEC plus 832',
    type: 'combi',
    output_kw: 32,
    fuel_type: 'gas',
    common_fault_codes: ['F28', 'F29', 'F75'],
    introduced_year: 2018,
  },
};

/**
 * Boiler model pattern matching
 *
 * Helps extract model from casual speech
 * e.g., "thirty eye" → "30i"
 */
export const BOILER_MODEL_PATTERNS: Array<{
  pattern: RegExp;
  normalized: string;
}> = [
  // Worcester Greenstar
  { pattern: /greenstar\s*30\s*i/i, normalized: 'Greenstar 30i' },
  { pattern: /thirty\s*eye/i, normalized: 'Greenstar 30i' },
  { pattern: /greenstar\s*25\s*si/i, normalized: 'Greenstar 25Si' },
  { pattern: /twenty[\s-]?five\s*s\s*i/i, normalized: 'Greenstar 25Si' },

  // Baxi
  { pattern: /duo[\s-]?tec\s*33/i, normalized: 'Duo-tec 33' },
  { pattern: /thirty[\s-]?three/i, normalized: 'Duo-tec 33' },

  // Ideal Logic
  { pattern: /logic\s*plus\s*30/i, normalized: 'Logic+ 30' },
  { pattern: /logic\s*30/i, normalized: 'Logic+ 30' },

  // Vaillant ecoTEC
  { pattern: /ecotec\s*plus\s*832/i, normalized: 'ecoTEC plus 832' },
  { pattern: /eco[\s-]?tec\s*eight\s*thirty[\s-]?two/i, normalized: 'ecoTEC plus 832' },
];

// ============================================
// Control Systems Catalog
// ============================================

/**
 * Control system definitions
 */
export interface ControlSystemDefinition {
  id: string;
  name: string;
  description: string;
  typical_components: string[];
  wiring_notes: string;
  common_issues: string[];
  diagnostic_checks: string[];
}

export const CONTROL_SYSTEMS: Record<string, ControlSystemDefinition> = {
  's_plan': {
    id: 's_plan',
    name: 'S-Plan',
    description: 'Separate zone valves for heating and hot water',
    typical_components: [
      'System boiler',
      'Hot water cylinder',
      'Cylinder thermostat',
      'Room thermostat',
      'Programmer',
      'Heating zone valve (2-port)',
      'Hot water zone valve (2-port)',
      'Pump',
      'Wiring centre',
    ],
    wiring_notes: 'Each zone valve has independent call for heat. Terminals: 1-3 for stat, 4-5 for valve motor.',
    common_issues: [
      'Zone valve stuck',
      'Cylinder stat wired incorrectly',
      'No demand at boiler despite zone calling',
    ],
    diagnostic_checks: [
      'Check stat calling (terminals 1-3)',
      'Check valve motor operating (terminals 4-5)',
      'Check micro-switch operation',
      'Verify wiring at wiring centre',
      'Check pump overrun',
    ],
  },

  'y_plan': {
    id: 'y_plan',
    name: 'Y-Plan',
    description: 'Single 3-port valve controlling heating and hot water',
    typical_components: [
      'System boiler',
      'Hot water cylinder',
      'Cylinder thermostat',
      'Room thermostat',
      'Programmer',
      '3-port mid-position valve',
      'Pump',
      'Wiring centre',
    ],
    wiring_notes: '3-port valve has three positions: heating only, HW only, or both. Grey wire = HW, white wire = heating.',
    common_issues: [
      '3-port valve stuck in one position',
      'Motor head failed',
      'Cylinder stat not cutting off',
    ],
    diagnostic_checks: [
      'Check valve position (lever on side)',
      'Check grey wire for HW demand',
      'Check white wire for CH demand',
      'Verify cylinder stat operation',
      'Test valve motor manually',
    ],
  },

  'c_plan': {
    id: 'c_plan',
    name: 'C-Plan',
    description: 'Gravity hot water with pumped heating (old systems)',
    typical_components: [
      'Regular boiler',
      'Hot water cylinder',
      'Cylinder thermostat',
      'Room thermostat',
      'Programmer',
      'Motorized valve (heating only)',
      'Pump (heating circuit only)',
    ],
    wiring_notes: 'Hot water is gravity fed (no pump). Heating circuit is pumped with zone valve.',
    common_issues: [
      'Poor HW circulation (gravity issue)',
      'Heating valve stuck',
      'Pump not running',
    ],
    diagnostic_checks: [
      'Check gravity circuit flow',
      'Verify heating valve operation',
      'Check pump running on heating call',
      'Cylinder stat operation',
    ],
  },

  'w_plan': {
    id: 'w_plan',
    name: 'W-Plan',
    description: 'Combi boiler with additional zone for existing radiators',
    typical_components: [
      'Combi boiler',
      'Additional zone valve',
      'Room thermostat (zone)',
      'Existing heating circuit',
    ],
    wiring_notes: 'Combi handles HW directly. Additional zone valve added for existing radiators.',
    common_issues: [
      'Zone valve not operating',
      'Combi and zone demand conflict',
    ],
    diagnostic_checks: [
      'Check zone valve wiring',
      'Verify stat operation',
      'Check combi mode (HW vs CH)',
    ],
  },

  'combi_only': {
    id: 'combi_only',
    name: 'Combi (No External Controls)',
    description: 'Simple combi boiler with minimal external controls',
    typical_components: [
      'Combi boiler',
      'Room thermostat',
      'Programmer (optional)',
    ],
    wiring_notes: 'Minimal wiring. Stat connects directly to boiler terminals (usually T1/T2).',
    common_issues: [
      'No demand reaching boiler',
      'Stat wired incorrectly',
    ],
    diagnostic_checks: [
      'Check stat calling',
      'Check boiler terminals for demand',
      'Verify internal boiler PCB',
    ],
  },
};

/**
 * Control system recognition patterns
 *
 * Helps identify control system from casual speech
 */
export const CONTROL_SYSTEM_PATTERNS: Array<{
  pattern: RegExp;
  system_id: string;
}> = [
  { pattern: /s[\s-]?plan/i, system_id: 's_plan' },
  { pattern: /y[\s-]?plan/i, system_id: 'y_plan' },
  { pattern: /c[\s-]?plan/i, system_id: 'c_plan' },
  { pattern: /w[\s-]?plan/i, system_id: 'w_plan' },
  { pattern: /zone\s*valve/i, system_id: 's_plan' }, // Likely S-Plan
  { pattern: /three[\s-]?port\s*valve/i, system_id: 'y_plan' },
  { pattern: /3[\s-]?port\s*valve/i, system_id: 'y_plan' },
  { pattern: /gravity\s*hot\s*water/i, system_id: 'c_plan' },
  { pattern: /combi\s*only/i, system_id: 'combi_only' },
];

// ============================================
// Component Recognition
// ============================================

/**
 * Component aliases
 *
 * Engineers use jargon: "prv passing", "stat calling", "TRV"
 */
export const COMPONENT_ALIASES: Record<string, string> = {
  // PRV
  'prv': 'pressure_relief_valve',
  'pressure relief valve': 'pressure_relief_valve',
  'safety valve': 'pressure_relief_valve',

  // Thermostats
  'stat': 'thermostat',
  'room stat': 'room_thermostat',
  'cylinder stat': 'cylinder_thermostat',

  // TRV
  'trv': 'thermostatic_radiator_valve',
  'tear away valve': 'thermostatic_radiator_valve', // Common speech-to-text error
  'tearaway valve': 'thermostatic_radiator_valve',

  // Valves
  'zone valve': 'zone_valve',
  '2 port': '2_port_valve',
  'two port': '2_port_valve',
  '3 port': '3_port_valve',
  'three port': '3_port_valve',

  // Cylinder
  'cylinder': 'hot_water_cylinder',
  'hw cylinder': 'hot_water_cylinder',
  'tank': 'hot_water_cylinder',

  // Expansion vessel
  'expansion vessel': 'expansion_vessel',
  'exp vessel': 'expansion_vessel',
  'pressure vessel': 'expansion_vessel',

  // Pump
  'pump': 'circulating_pump',

  // Filter
  'filter': 'magnetic_filter',
  'mag filter': 'magnetic_filter',

  // Filling loop
  'filling loop': 'filling_loop',
  'fill loop': 'filling_loop',
};

// ============================================
// Diagnostic Event Patterns
// ============================================

/**
 * Common diagnostic observations and their implications
 */
export interface DiagnosticPattern {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'minor' | 'moderate' | 'serious' | 'critical';
  common_causes: string[];
  diagnostic_checks: string[];
  sop_reference?: string;
}

export const DIAGNOSTIC_PATTERNS: Record<string, DiagnosticPattern> = {
  'prv_passing': {
    id: 'prv_passing',
    name: 'PRV Passing/Discharging',
    description: 'Pressure relief valve is releasing water',
    severity: 'moderate',
    common_causes: [
      'System overpressure (above 3 bar)',
      'Expansion vessel failure',
      'PRV debris preventing seal',
      'Overfilling',
    ],
    diagnostic_checks: [
      'Check system pressure (should be 1-1.5 bar cold)',
      'Test expansion vessel charge (should be 0.5-1 bar)',
      'Inspect PRV seat for debris',
      'Check filling loop fully closed',
      'Verify boiler pressure sensor reading',
    ],
    sop_reference: 'SOP-PRV-001',
  },

  'stat_calling_no_heat': {
    id: 'stat_calling_no_heat',
    name: 'Thermostat Calling, No Heat',
    description: 'Stat is calling for heat but system not responding',
    severity: 'serious',
    common_causes: [
      'Zone valve stuck closed',
      'Wiring fault',
      'Boiler not receiving demand',
      'Pump not running',
      'Valve micro-switch failed',
    ],
    diagnostic_checks: [
      'Check stat terminals 1-3 for continuity',
      'Verify zone valve motor operating (terminals 4-5)',
      'Check micro-switch on valve',
      'Test boiler demand terminals',
      'Check pump overrun relay',
      'Verify wiring centre connections',
    ],
    sop_reference: 'SOP-CTRL-001',
  },

  'no_hot_water': {
    id: 'no_hot_water',
    name: 'No Hot Water',
    description: 'No hot water production despite demand',
    severity: 'serious',
    common_causes: [
      'Cylinder stat satisfied/faulty',
      '2-port valve stuck closed',
      'Wiring issue',
      'Boiler not firing for HW',
      'Pump not running',
    ],
    diagnostic_checks: [
      'Check cylinder stat operation',
      'Test 2-port valve motor',
      'Verify valve micro-switch',
      'Check HW demand at boiler (terminal 4 or 6)',
      'Test pump running',
      'Check boiler mode (HW selected)',
    ],
    sop_reference: 'SOP-HW-001',
  },

  'intermittent_lockout': {
    id: 'intermittent_lockout',
    name: 'Intermittent Boiler Lockout',
    description: 'Boiler locks out randomly',
    severity: 'serious',
    common_causes: [
      'Ignition fault',
      'Gas pressure issue',
      'Flue blockage',
      'Overheat (poor circulation)',
      'Flame sensing fault',
    ],
    diagnostic_checks: [
      'Check fault code',
      'Test gas pressure (standing and working)',
      'Inspect flue for blockages',
      'Check pump running',
      'Test ignition leads',
      'Clean flame sensor',
      'Check system flow',
    ],
    sop_reference: 'SOP-LOCKOUT-001',
  },

  'pump_overrun': {
    id: 'pump_overrun',
    name: 'Pump Overrun Issue',
    description: 'Pump not running after boiler fires / running continuously',
    severity: 'moderate',
    common_causes: [
      'Pump overrun relay stuck',
      'Wiring fault',
      'Pump seized',
      'Boiler PCB fault',
    ],
    diagnostic_checks: [
      'Check pump overrun setting',
      'Test relay operation',
      'Verify pump not seized',
      'Check wiring to pump',
      'Test boiler PCB outputs',
    ],
    sop_reference: 'SOP-PUMP-001',
  },

  'pressure_loss': {
    id: 'pressure_loss',
    name: 'System Losing Pressure',
    description: 'Pressure gauge drops over time',
    severity: 'moderate',
    common_causes: [
      'Leak on system',
      'PRV weeping',
      'Expansion vessel bladder punctured',
      'Auto air vent releasing',
    ],
    diagnostic_checks: [
      'Visual inspection for leaks',
      'Check under boiler',
      'Inspect PRV discharge pipe',
      'Test expansion vessel',
      'Check radiator valves',
      'Inspect pipe joints',
    ],
    sop_reference: 'SOP-PRESSURE-001',
  },
};

/**
 * Diagnostic pattern recognition from text
 */
export const DIAGNOSTIC_TEXT_PATTERNS: Array<{
  pattern: RegExp;
  diagnostic_id: string;
}> = [
  { pattern: /prv\s*(is\s*)?(passing|discharging|weeping|dripping)/i, diagnostic_id: 'prv_passing' },
  { pattern: /pressure\s*relief\s*valve\s*(passing|dripping)/i, diagnostic_id: 'prv_passing' },

  { pattern: /(stat|thermostat)\s*(is\s*)?calling.*no\s*heat/i, diagnostic_id: 'stat_calling_no_heat' },
  { pattern: /demand.*but.*no\s*heat/i, diagnostic_id: 'stat_calling_no_heat' },

  { pattern: /no\s*hot\s*water/i, diagnostic_id: 'no_hot_water' },
  { pattern: /hw\s*not\s*working/i, diagnostic_id: 'no_hot_water' },

  { pattern: /intermittent.*lockout/i, diagnostic_id: 'intermittent_lockout' },
  { pattern: /keeps\s*locking\s*out/i, diagnostic_id: 'intermittent_lockout' },

  { pattern: /pump.*not.*running/i, diagnostic_id: 'pump_overrun' },
  { pattern: /pump.*overrun/i, diagnostic_id: 'pump_overrun' },

  { pattern: /losing\s*pressure/i, diagnostic_id: 'pressure_loss' },
  { pattern: /pressure.*dropping/i, diagnostic_id: 'pressure_loss' },
];

// ============================================
// Fault Code Catalog
// ============================================

/**
 * Common fault codes by manufacturer
 */
export interface FaultCode {
  code: string;
  make: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  common_causes: string[];
  recommended_checks: string[];
}

export const FAULT_CODES: Record<string, FaultCode> = {
  // Worcester Bosch
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

  // Baxi
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

  // Ideal
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

  // Vaillant
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
};

// ============================================
// Engineering Jargon Normalization
// ============================================

/**
 * Common speech-to-text errors and engineering slang
 *
 * Engineers say things that STT mangles. Fix them deterministically.
 */
export const JARGON_NORMALIZATION: Array<{
  pattern: RegExp;
  replacement: string;
  notes?: string;
}> = [
  // Heating jargon
  {
    pattern: /monkey\s+(mock|muck|mock)/gi,
    replacement: 'monkey muck',
    notes: 'Asbestos-based pipe lagging (historical)',
  },

  // Thermostatic radiator valve
  { pattern: /TRB/g, replacement: 'TRV', notes: 'Common STT error' },
  { pattern: /tear[\s-]?away\s*valve/gi, replacement: 'TRV', notes: 'STT mishears TRV' },
  { pattern: /tearaway\s*valve/gi, replacement: 'TRV' },

  // Microbore
  { pattern: /micro[\s-]?bore/gi, replacement: 'microbore' },

  // S-Plan, Y-Plan
  { pattern: /s[\s-]?plan/gi, replacement: 'S-Plan' },
  { pattern: /y[\s-]?plan/gi, replacement: 'Y-Plan' },
  { pattern: /c[\s-]?plan/gi, replacement: 'C-Plan' },
  { pattern: /w[\s-]?plan/gi, replacement: 'W-Plan' },

  // Measurements
  { pattern: /(\d+)\s*mil/gi, replacement: '$1mm', notes: 'Millimeters' },
  { pattern: /fifteen\s*mil/gi, replacement: '15mm' },
  { pattern: /twenty[\s-]?two\s*mil/gi, replacement: '22mm' },
  { pattern: /twenty[\s-]?eight\s*mil/gi, replacement: '28mm' },

  // Boiler types
  { pattern: /combination\s+boiler/gi, replacement: 'combi' },
  { pattern: /back\s+boiler/gi, replacement: 'back boiler' },

  // Components
  { pattern: /PRV/gi, replacement: 'PRV', notes: 'Pressure relief valve' },
  { pattern: /pressure\s+relief/gi, replacement: 'PRV' },
];

// ============================================
// All catalogs are already exported inline above
// ============================================

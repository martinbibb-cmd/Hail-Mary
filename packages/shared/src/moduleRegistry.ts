/**
 * Module Registry for Hail-Mary
 * 
 * Defines all mini apps/modules in the system, their phases, and status.
 * This enables a plug-in architecture where new trades can be added easily.
 */

/**
 * Module IDs - all available modules in the system
 */
export type ModuleId = 
  | 'core'           // Property/Core information
  | 'central_heating' // Boiler/CH survey
  | 'heat_pump'       // Heat pump suitability
  | 'pv'              // Solar PV
  | 'ev'              // EV charging
  | 'hazards'         // Hazards (asbestos, monkey muck, etc.)
  | 'roadmap'         // Upgrade roadmap
  | 'roofing'         // Future: Roofing trade
  | 'insulation'      // Future: Insulation trade
  | 'glazing'         // Future: Glazing trade
  | 'electrical'      // Future: Electrical rewire
  | 'other';          // Other/future trades

/**
 * Development phase when module becomes active
 */
export type ModulePhase = 1 | 2 | 3;

/**
 * Module status indicating current development state
 */
export type ModuleStatus = 
  | 'live'      // Fully functional
  | 'stub'      // Placeholder with minimal UI
  | 'planned';  // Not yet implemented

/**
 * Module metadata describing each mini app
 */
export interface ModuleMeta {
  /** Unique identifier for the module */
  id: ModuleId;
  /** Human-readable label */
  label: string;
  /** Icon emoji for UI display */
  icon: string;
  /** Short description of what the module does */
  description: string;
  /** Phase when module is introduced (1 = now, 2 = near future, 3 = later) */
  phaseIntroduced: ModulePhase;
  /** Current development status */
  status: ModuleStatus;
  /** Whether this module has a UI component */
  hasUi: boolean;
  /** Whether this module is enabled for use */
  enabled: boolean;
  /** Tab order for navigation (lower = more left) */
  navOrder: number;
  /** Related topic tags this module handles */
  topicTags: string[];
  /** Dependencies on other modules */
  dependencies?: ModuleId[];
  /** Notes about the module's purpose or status */
  notes?: string;
}

/**
 * Complete module registry - all mini apps in the system
 */
export const moduleRegistry: ModuleMeta[] = [
  // ============================================
  // Phase 1 - Core modules (Live Now)
  // ============================================
  {
    id: 'core',
    label: 'Property',
    icon: '🏠',
    description: 'Property details, fabric info, occupancy patterns',
    phaseIntroduced: 1,
    status: 'live',
    hasUi: true,
    enabled: true,
    navOrder: 1,
    topicTags: ['fabric', 'lifestyle'],
    notes: 'Core property information - always active',
  },
  {
    id: 'central_heating',
    label: 'Boiler / CH',
    icon: '🔥',
    description: 'Central heating survey - boiler, flue, pipework, emitters, controls',
    phaseIntroduced: 1,
    status: 'live',
    hasUi: true,
    enabled: true,
    navOrder: 2,
    topicTags: ['boiler', 'emitters', 'controls', 'cylinder'],
    notes: 'The flagship module - best boiler survey UI in the UK',
  },
  {
    id: 'hazards',
    label: 'Hazards',
    icon: '⚠️',
    description: 'Asbestos, monkey muck, legacy materials, access restrictions',
    phaseIntroduced: 1,
    status: 'live',
    hasUi: true,
    enabled: true,
    navOrder: 6,
    topicTags: ['hazards', 'emitters'],
    notes: 'Critical for safety - affects CH outcomes',
  },

  // ============================================
  // Phase 1 - Stubs (Dead Legs)
  // ============================================
  {
    id: 'heat_pump',
    label: 'Heat Pump',
    icon: '♨️',
    description: 'Heat pump suitability, emitter changes, cylinder, outdoor placement',
    phaseIntroduced: 2,
    status: 'stub',
    hasUi: true,
    enabled: true,
    navOrder: 3,
    topicTags: ['hp_overview', 'hp_outdoor', 'emitters', 'cylinder', 'electrics'],
    dependencies: ['central_heating'],
    notes: 'Phase 2: HP suitability + emitter checks',
  },
  {
    id: 'pv',
    label: 'Solar PV',
    icon: '☀️',
    description: 'Solar PV - roof aspects, shading, inverter location, electrics',
    phaseIntroduced: 2,
    status: 'stub',
    hasUi: true,
    enabled: true,
    navOrder: 4,
    topicTags: ['roof', 'electrics', 'lifestyle'],
    notes: 'Phase 2: Full PV module with roof + shading analysis',
  },
  {
    id: 'ev',
    label: 'EV Charging',
    icon: '🔌',
    description: 'EV charger - parking, cable route, fuse, earthing, load management',
    phaseIntroduced: 2,
    status: 'stub',
    hasUi: true,
    enabled: true,
    navOrder: 5,
    topicTags: ['parking', 'electrics', 'lifestyle'],
    notes: 'Phase 2: Full EV charger planning',
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    icon: '🗺️',
    description: 'Upgrade roadmap - 0-2, 2-5, 5-15 year plans',
    phaseIntroduced: 3,
    status: 'stub',
    hasUi: true,
    enabled: true,
    navOrder: 7,
    topicTags: [],
    dependencies: ['core', 'central_heating', 'heat_pump', 'pv', 'ev'],
    notes: 'Phase 3: Full upgrade engine with multi-year planning',
  },

  // ============================================
  // Future Trades (Generic Dead Legs)
  // ============================================
  {
    id: 'roofing',
    label: 'Roofing',
    icon: '🏗️',
    description: 'Roofing survey and quotes',
    phaseIntroduced: 3,
    status: 'planned',
    hasUi: false,
    enabled: false,
    navOrder: 100,
    topicTags: ['roof'],
    notes: 'Future trade - Phase TBD',
  },
  {
    id: 'insulation',
    label: 'Insulation',
    icon: '🧱',
    description: 'Insulation survey - cavity, solid wall, loft',
    phaseIntroduced: 3,
    status: 'planned',
    hasUi: false,
    enabled: false,
    navOrder: 101,
    topicTags: ['fabric'],
    notes: 'Future trade - Phase TBD',
  },
  {
    id: 'glazing',
    label: 'Glazing',
    icon: '🪟',
    description: 'Windows and doors survey',
    phaseIntroduced: 3,
    status: 'planned',
    hasUi: false,
    enabled: false,
    navOrder: 102,
    topicTags: ['fabric'],
    notes: 'Future trade - Phase TBD',
  },
  {
    id: 'electrical',
    label: 'Electrical',
    icon: '⚡',
    description: 'Full electrical rewire survey',
    phaseIntroduced: 3,
    status: 'planned',
    hasUi: false,
    enabled: false,
    navOrder: 103,
    topicTags: ['electrics'],
    notes: 'Future trade - Phase TBD',
  },
  {
    id: 'other',
    label: 'Other Trades',
    icon: '🔧',
    description: 'Future modules and other trades',
    phaseIntroduced: 1,
    status: 'stub',
    hasUi: true,
    enabled: true,
    navOrder: 99,
    topicTags: [],
    notes: 'Gateway for future/third-party modules',
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get a module by ID
 */
export function getModule(id: ModuleId): ModuleMeta | undefined {
  return moduleRegistry.find(m => m.id === id);
}

/**
 * Get all enabled modules
 */
export function getEnabledModules(): ModuleMeta[] {
  return moduleRegistry.filter(m => m.enabled);
}

/**
 * Get modules with UI (for navigation)
 */
export function getNavModules(): ModuleMeta[] {
  return moduleRegistry
    .filter(m => m.enabled && m.hasUi)
    .sort((a, b) => a.navOrder - b.navOrder);
}

/**
 * Get live modules (fully functional)
 */
export function getLiveModules(): ModuleMeta[] {
  return moduleRegistry.filter(m => m.status === 'live');
}

/**
 * Get stub modules (dead legs)
 */
export function getStubModules(): ModuleMeta[] {
  return moduleRegistry.filter(m => m.status === 'stub');
}

/**
 * Get planned (future) modules
 */
export function getPlannedModules(): ModuleMeta[] {
  return moduleRegistry.filter(m => m.status === 'planned');
}

/**
 * Get modules by phase
 */
export function getModulesByPhase(phase: ModulePhase): ModuleMeta[] {
  return moduleRegistry.filter(m => m.phaseIntroduced === phase);
}

/**
 * Get modules that handle a specific topic
 */
export function getModulesForTopic(topic: string): ModuleMeta[] {
  return moduleRegistry.filter(m => m.topicTags.includes(topic));
}

/**
 * Check if a module is ready (live status)
 */
export function isModuleReady(id: ModuleId): boolean {
  const module = getModule(id);
  if (!module) return false;
  return module.status === 'live';
}

/**
 * Register a new module (for third-party/plugin support)
 */
export function registerModule(module: ModuleMeta): void {
  const existingIndex = moduleRegistry.findIndex(m => m.id === module.id);
  if (existingIndex >= 0) {
    moduleRegistry[existingIndex] = module;
  } else {
    moduleRegistry.push(module);
  }
}

/**
 * Milestone Definitions
 *
 * Standard milestones for heating system surveys and their requirements
 */

import { MilestoneDefinition, StandardMilestone, FactCategory } from './types';

// Re-export StandardMilestone for convenience
export { StandardMilestone } from './types';

/**
 * Standard Milestone Definitions
 * These define what's needed to complete each milestone
 */
export const MILESTONE_DEFINITIONS: Record<string, MilestoneDefinition> = {
  // Property Assessment
  [StandardMilestone.PROPERTY_SURVEYED]: {
    key: StandardMilestone.PROPERTY_SURVEYED,
    label: 'Property Surveyed',
    description: 'Basic property characteristics captured',
    requiredFactCategories: ['property', 'structure'],
    criticalityLevel: 'critical',
    dependencies: [],
  },

  [StandardMilestone.EXISTING_SYSTEM_ASSESSED]: {
    key: StandardMilestone.EXISTING_SYSTEM_ASSESSED,
    label: 'Existing System Assessed',
    description: 'Current heating system documented',
    requiredFactCategories: ['existing_system'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.PROPERTY_SURVEYED],
  },

  // Technical Specifications
  [StandardMilestone.HEATING_SYSTEM_SPEC]: {
    key: StandardMilestone.HEATING_SYSTEM_SPEC,
    label: 'Heating System Specification',
    description: 'New heating system fully specified',
    requiredFactCategories: ['existing_system', 'customer'],
    criticalityLevel: 'critical',
    dependencies: [
      StandardMilestone.EXISTING_SYSTEM_ASSESSED,
      StandardMilestone.CUSTOMER_REQUIREMENTS_CAPTURED,
    ],
  },

  [StandardMilestone.ELECTRICAL_CAPACITY_CONFIRMED]: {
    key: StandardMilestone.ELECTRICAL_CAPACITY_CONFIRMED,
    label: 'Electrical Capacity Confirmed',
    description: 'Electrical supply adequate for new system',
    requiredFactCategories: ['electrical'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.HEATING_SYSTEM_SPEC],
  },

  [StandardMilestone.GAS_SUPPLY_ASSESSED]: {
    key: StandardMilestone.GAS_SUPPLY_ASSESSED,
    label: 'Gas Supply Assessed',
    description: 'Gas supply and pipework evaluated',
    requiredFactCategories: ['gas'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.EXISTING_SYSTEM_ASSESSED],
  },

  [StandardMilestone.WATER_SUPPLY_ASSESSED]: {
    key: StandardMilestone.WATER_SUPPLY_ASSESSED,
    label: 'Water Supply Assessed',
    description: 'Water supply pressure and pipework checked',
    requiredFactCategories: ['water'],
    criticalityLevel: 'important',
    dependencies: [StandardMilestone.PROPERTY_SURVEYED],
  },

  [StandardMilestone.FLUE_ROUTE_VALIDATED]: {
    key: StandardMilestone.FLUE_ROUTE_VALIDATED,
    label: 'Flue Route Validated',
    description: 'Flue termination complies with BS 5440',
    requiredFactCategories: ['structure', 'regulatory'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.HEATING_SYSTEM_SPEC],
  },

  // Customer Requirements
  [StandardMilestone.CUSTOMER_REQUIREMENTS_CAPTURED]: {
    key: StandardMilestone.CUSTOMER_REQUIREMENTS_CAPTURED,
    label: 'Customer Requirements Captured',
    description: 'Customer needs and preferences documented',
    requiredFactCategories: ['customer'],
    criticalityLevel: 'critical',
    dependencies: [],
  },

  [StandardMilestone.BUDGET_DISCUSSED]: {
    key: StandardMilestone.BUDGET_DISCUSSED,
    label: 'Budget Discussed',
    description: 'Budget expectations and constraints captured',
    requiredFactCategories: ['customer'],
    criticalityLevel: 'important',
    dependencies: [StandardMilestone.CUSTOMER_REQUIREMENTS_CAPTURED],
  },

  // Compliance
  [StandardMilestone.BUILDING_REGS_CHECKED]: {
    key: StandardMilestone.BUILDING_REGS_CHECKED,
    label: 'Building Regulations Checked',
    description: 'Compliance with Building Regs verified',
    requiredFactCategories: ['regulatory'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.HEATING_SYSTEM_SPEC],
  },

  [StandardMilestone.MANUFACTURER_INSTRUCTIONS_CHECKED]: {
    key: StandardMilestone.MANUFACTURER_INSTRUCTIONS_CHECKED,
    label: 'Manufacturer Instructions Checked',
    description: 'MI requirements verified (takes precedence over Building Regs)',
    requiredFactCategories: ['regulatory'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.HEATING_SYSTEM_SPEC],
  },

  [StandardMilestone.HAZARDS_IDENTIFIED]: {
    key: StandardMilestone.HAZARDS_IDENTIFIED,
    label: 'Hazards Identified',
    description: 'Safety hazards and risks documented',
    requiredFactCategories: ['hazards'],
    criticalityLevel: 'critical',
    dependencies: [StandardMilestone.PROPERTY_SURVEYED],
  },

  // Outputs
  [StandardMilestone.QUOTE_OPTIONS_GENERATED]: {
    key: StandardMilestone.QUOTE_OPTIONS_GENERATED,
    label: 'Quote Options Generated',
    description: 'Multiple quote options ready for customer',
    requiredFactCategories: ['customer'],
    criticalityLevel: 'critical',
    dependencies: [
      StandardMilestone.HEATING_SYSTEM_SPEC,
      StandardMilestone.ELECTRICAL_CAPACITY_CONFIRMED,
      StandardMilestone.BUILDING_REGS_CHECKED,
      StandardMilestone.MANUFACTURER_INSTRUCTIONS_CHECKED,
    ],
  },

  [StandardMilestone.PDF_REPORT_READY]: {
    key: StandardMilestone.PDF_REPORT_READY,
    label: 'PDF Report Ready',
    description: 'Conservative PDF report ready to leave with customer',
    requiredFactCategories: [],
    criticalityLevel: 'important',
    dependencies: [StandardMilestone.QUOTE_OPTIONS_GENERATED],
  },

  [StandardMilestone.CUSTOMER_PORTAL_READY]: {
    key: StandardMilestone.CUSTOMER_PORTAL_READY,
    label: 'Customer Portal Ready',
    description: 'Interactive portal showing options and trade-offs',
    requiredFactCategories: [],
    criticalityLevel: 'optional',
    dependencies: [StandardMilestone.QUOTE_OPTIONS_GENERATED],
  },
};

/**
 * Get milestone definition by key
 */
export function getMilestoneDefinition(key: string): MilestoneDefinition | undefined {
  return MILESTONE_DEFINITIONS[key];
}

/**
 * Get all critical milestones
 */
export function getCriticalMilestones(): MilestoneDefinition[] {
  return Object.values(MILESTONE_DEFINITIONS).filter(
    (m) => m.criticalityLevel === 'critical'
  );
}

/**
 * Get milestone dependencies (recursive)
 */
export function getMilestoneDependencies(key: string): string[] {
  const definition = MILESTONE_DEFINITIONS[key];
  if (!definition) return [];

  const deps = new Set<string>();
  const queue = [...definition.dependencies];

  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (deps.has(dep)) continue;

    deps.add(dep);
    const depDefinition = MILESTONE_DEFINITIONS[dep];
    if (depDefinition) {
      queue.push(...depDefinition.dependencies);
    }
  }

  return Array.from(deps);
}

/**
 * Check if milestone can be started (all dependencies complete)
 */
export function canStartMilestone(
  key: string,
  completedMilestones: Set<string>
): boolean {
  const definition = MILESTONE_DEFINITIONS[key];
  if (!definition) return false;

  return definition.dependencies.every((dep) => completedMilestones.has(dep));
}

/**
 * Survey Helper Service
 * 
 * This service manages the Survey Helper engine that guides engineers through
 * site surveys by suggesting context-aware questions (slots) and tracking
 * the completeness of the SystemSpecDraft.
 */

import type {
  SurveySlot,
  SystemSpecDraft,
  ModuleName,
  TopicTag,
  Priority,
  ModuleCompleteness,
  SlotPrecondition,
} from '@hail-mary/shared';
import {
  allSurveySlots,
  getSlotsForModules,
  getSlotById,
} from '@hail-mary/shared';

/**
 * Get value from a nested object using dot-notation path
 */
export function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Set value in a nested object using dot-notation path
 * Creates intermediate objects as needed
 */
export function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Check if a slot's preconditions are met
 */
export function checkPreconditions(
  slot: SurveySlot,
  specDraft: SystemSpecDraft
): boolean {
  if (!slot.preconditions || slot.preconditions.length === 0) {
    return true;
  }

  for (const precondition of slot.preconditions) {
    const value = getValueAtPath(specDraft as unknown as Record<string, unknown>, precondition.path);
    
    switch (precondition.operator) {
      case 'equals':
        if (value !== precondition.value) return false;
        break;
      case 'not_equals':
        if (value === precondition.value) return false;
        break;
      case 'exists':
        if (value === undefined || value === null) return false;
        break;
      case 'not_exists':
        if (value !== undefined && value !== null) return false;
        break;
      case 'in':
        if (!Array.isArray(precondition.value) || !precondition.value.includes(value)) return false;
        break;
    }
  }

  return true;
}

/**
 * Check if a slot is satisfied (has a value in the spec)
 */
export function isSlotSatisfied(slot: SurveySlot, specDraft: SystemSpecDraft): boolean {
  const value = getValueAtPath(specDraft as unknown as Record<string, unknown>, slot.path);
  
  // null is a valid "don't know" value for some fields
  // undefined means never set
  if (value === undefined) {
    return false;
  }
  
  // Empty arrays are not satisfied
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  
  // Empty strings are not satisfied
  if (value === '') {
    return false;
  }
  
  return true;
}

/**
 * Score a slot based on priority, topic match, and transcript hints
 */
export function scoreSlot(
  slot: SurveySlot,
  currentTopic: TopicTag | null,
  recentTranscriptText?: string
): number {
  let score = 0;

  // Priority scoring
  switch (slot.priority) {
    case 'critical':
      score += 100;
      break;
    case 'important':
      score += 50;
      break;
    case 'nice_to_have':
      score += 10;
      break;
  }

  // Topic match bonus
  if (currentTopic && slot.topic === currentTopic) {
    score += 30;
  }

  // Trigger mode bonuses
  if (slot.triggerMode === 'always') {
    score += 20;
  } else if (slot.triggerMode === 'topic_change' && currentTopic && slot.topic === currentTopic) {
    score += 25;
  }

  // Transcript hint bonus - if recent transcript mentions something related
  if (recentTranscriptText) {
    const text = recentTranscriptText.toLowerCase();
    
    // Check for keyword matches based on slot
    const keywordMap: Record<string, string[]> = {
      'ch.system.type': ['combi', 'boiler', 'system', 'regular', 'back boiler'],
      'ch.system.fuel': ['gas', 'oil', 'lpg', 'electric'],
      'ch.boiler.age_band': ['old', 'new', 'years', 'age'],
      'ch.flue.category': ['flue', 'balanced', 'fanned'],
      'ch.pipework.type': ['microbore', 'pipe', '15mm', '8mm', '10mm'],
      'ch.water.sludge_level': ['sludge', 'dirty', 'black', 'clean'],
      'hp.system.mode': ['heat pump', 'hybrid', 'replace'],
      'hp.outdoor.location_quality': ['outside', 'garden', 'outdoor'],
      'pv.roof.main_aspect': ['roof', 'south', 'east', 'west'],
      'ev.parking.off_street': ['parking', 'drive', 'driveway', 'garage'],
      'haz.asbestos.monkey_muck': ['monkey muck', 'asbestos', 'paste'],
    };

    const keywords = keywordMap[slot.id];
    if (keywords) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 15;
          break;
        }
      }
    }
  }

  return score;
}

/**
 * Get the next question to ask based on current state
 */
export function getNextQuestion(
  specDraft: SystemSpecDraft,
  activeModules: ModuleName[],
  currentTopic: TopicTag | null,
  askedSlotIds: string[],
  recentTranscriptText?: string
): SurveySlot | null {
  // Get slots for active modules (always includes core and hazards)
  const modulesToInclude = [...new Set([...activeModules, 'core', 'hazards'])] as ModuleName[];
  const availableSlots = getSlotsForModules(modulesToInclude);

  // Filter slots
  const candidateSlots = availableSlots.filter((slot: SurveySlot) => {
    // Skip if already asked
    if (askedSlotIds.includes(slot.id)) {
      return false;
    }

    // Skip if already satisfied
    if (isSlotSatisfied(slot, specDraft)) {
      return false;
    }

    // Skip if preconditions not met
    if (!checkPreconditions(slot, specDraft)) {
      return false;
    }

    // For rare_hazard trigger mode, only show if specifically triggered
    if (slot.triggerMode === 'rare_hazard') {
      // Only trigger monkey muck if transcript mentions it
      if (slot.id === 'haz.asbestos.monkey_muck') {
        if (!recentTranscriptText || 
            (!recentTranscriptText.toLowerCase().includes('monkey muck') && 
             !recentTranscriptText.toLowerCase().includes('asbestos paste'))) {
          return false;
        }
      }
    }

    return true;
  });

  if (candidateSlots.length === 0) {
    return null;
  }

  // Score and sort slots
  const scoredSlots = candidateSlots.map((slot: SurveySlot) => ({
    slot,
    score: scoreSlot(slot, currentTopic, recentTranscriptText),
  }));

  scoredSlots.sort((a: { slot: SurveySlot; score: number }, b: { slot: SurveySlot; score: number }) => b.score - a.score);

  return scoredSlots[0].slot;
}

/**
 * Calculate completeness for a specific module
 */
export function calculateModuleCompleteness(
  module: ModuleName,
  specDraft: SystemSpecDraft
): ModuleCompleteness {
  const moduleSlots = allSurveySlots.filter((slot: SurveySlot) => slot.module === module);

  const criticalSlots = moduleSlots.filter((s: SurveySlot) => s.priority === 'critical');
  const importantSlots = moduleSlots.filter((s: SurveySlot) => s.priority === 'important');

  const filledCritical = criticalSlots.filter((s: SurveySlot) => isSlotSatisfied(s, specDraft)).length;
  const filledImportant = importantSlots.filter((s: SurveySlot) => isSlotSatisfied(s, specDraft)).length;

  const totalCritical = criticalSlots.length;
  const totalImportant = importantSlots.length;

  // Calculate percentage (weight critical more heavily)
  const criticalWeight = 0.7;
  const importantWeight = 0.3;
  
  const criticalPercentage = totalCritical > 0 ? (filledCritical / totalCritical) * 100 : 100;
  const importantPercentage = totalImportant > 0 ? (filledImportant / totalImportant) * 100 : 100;
  
  const percentage = Math.round(
    criticalPercentage * criticalWeight + importantPercentage * importantWeight
  );

  // Generate warnings
  const warnings: string[] = [];
  
  // Check for specific warning conditions
  if (module === 'heat_pump') {
    const mainFuseOk = getValueAtPath(
      specDraft as unknown as Record<string, unknown>,
      'heatPump.electrical.mainFuseOkForHPAndRest'
    );
    if (mainFuseOk === 'upgrade_required') {
      warnings.push('DNO supply upgrade likely required for heat pump');
    }
  }

  if (module === 'ev') {
    const mainFuseOk = getValueAtPath(
      specDraft as unknown as Record<string, unknown>,
      'ev.electricalCapacity.mainFuseOkForEV'
    );
    if (mainFuseOk === 'upgrade_required') {
      warnings.push('Main fuse upgrade may be required for EV charger');
    }
  }

  if (module === 'hazards') {
    const monkeyMuck = getValueAtPath(
      specDraft as unknown as Record<string, unknown>,
      'hazards.asbestos.monkeyMuckObserved'
    );
    if (monkeyMuck === 'confirmed' || monkeyMuck === 'suspected') {
      warnings.push('⚠️ Possible asbestos (monkey muck) identified - specialist removal may be required');
    }
  }

  return {
    module,
    filledCritical,
    totalCritical,
    filledImportant,
    totalImportant,
    percentage,
    warnings,
  };
}

/**
 * Calculate overall completeness across all active modules
 */
export function calculateOverallCompleteness(
  specDraft: SystemSpecDraft,
  activeModules: ModuleName[]
): {
  modules: ModuleCompleteness[];
  overallPercentage: number;
  readyToQuote: boolean;
  warnings: string[];
} {
  const modulesToCheck = [...new Set([...activeModules, 'core', 'hazards'])] as ModuleName[];
  
  const modules = modulesToCheck.map(module => 
    calculateModuleCompleteness(module, specDraft)
  );

  // Calculate overall percentage
  const overallPercentage = Math.round(
    modules.reduce((sum, m) => sum + m.percentage, 0) / modules.length
  );

  // Collect all warnings
  const warnings = modules.flatMap(m => m.warnings);

  // Determine if ready to quote (all critical fields for active modules filled)
  const readyToQuote = modules.every(m => m.filledCritical === m.totalCritical);

  return {
    modules,
    overallPercentage,
    readyToQuote,
    warnings,
  };
}

/**
 * Create a new empty SystemSpecDraft
 */
export function createEmptySpecDraft(
  sessionId: number,
  activeModules: ModuleName[]
): SystemSpecDraft {
  return {
    id: undefined,
    sessionId,
    activeModules,
    property: {},
    occupancyPattern: {},
    coreSupply: {},
    centralHeating: activeModules.includes('central_heating') ? {
      existingHeatSource: {},
      emitters: {},
      waterQuality: {},
    } : undefined,
    heatPump: activeModules.includes('heat_pump') ? {
      proposedSystem: {},
      emitterCheck: {},
      plantArea: {},
      outdoorUnit: {},
      electrical: {},
    } : undefined,
    solarPv: activeModules.includes('pv') ? {
      roofUse: {},
      structuralAndAccess: {},
      electricalIntegration: {},
      storageAndFuture: {},
    } : undefined,
    ev: activeModules.includes('ev') ? {
      parking: {},
      electricalCapacity: {},
      earthingAndRegs: {},
      smartIntegration: {},
    } : undefined,
    hazards: {
      asbestos: {},
      legacyMaterials: [],
      accessRestrictions: [],
    },
  };
}

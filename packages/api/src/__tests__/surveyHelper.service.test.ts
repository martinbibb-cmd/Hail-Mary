/**
 * Tests for Survey Helper Service
 */

import {
  getValueAtPath,
  setValueAtPath,
  checkPreconditions,
  isSlotSatisfied,
  scoreSlot,
  getNextQuestion,
  calculateModuleCompleteness,
  calculateOverallCompleteness,
  createEmptySpecDraft,
} from '../services/surveyHelper.service';
import type { SurveySlot, SystemSpecDraft, ModuleName, TopicTag } from '@hail-mary/shared';
import { allSurveySlots } from '@hail-mary/shared';

describe('Survey Helper Service', () => {
  describe('getValueAtPath', () => {
    it('should get a simple nested value', () => {
      const obj = { a: { b: { c: 'value' } } };
      expect(getValueAtPath(obj, 'a.b.c')).toBe('value');
    });

    it('should return undefined for non-existent path', () => {
      const obj = { a: { b: {} } };
      expect(getValueAtPath(obj, 'a.b.c')).toBeUndefined();
    });

    it('should handle null values in path', () => {
      const obj = { a: null };
      expect(getValueAtPath(obj as Record<string, unknown>, 'a.b')).toBeUndefined();
    });

    it('should handle top-level properties', () => {
      const obj = { name: 'test' };
      expect(getValueAtPath(obj, 'name')).toBe('test');
    });
  });

  describe('setValueAtPath', () => {
    it('should set a simple nested value', () => {
      const obj: Record<string, unknown> = {};
      setValueAtPath(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ a: { b: { c: 'value' } } });
    });

    it('should overwrite existing values', () => {
      const obj: Record<string, unknown> = { a: { b: { c: 'old' } } };
      setValueAtPath(obj, 'a.b.c', 'new');
      expect((obj.a as Record<string, unknown>).b).toEqual({ c: 'new' });
    });

    it('should create intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      setValueAtPath(obj, 'property.glazingType', 'double');
      expect(obj).toEqual({ property: { glazingType: 'double' } });
    });
  });

  describe('isSlotSatisfied', () => {
    const testSlot: SurveySlot = {
      id: 'test.slot',
      module: 'core',
      topic: 'fabric',
      path: 'property.propertyType',
      priority: 'critical',
      question: 'Test question?',
      chipOptions: [{ label: 'Test', value: 'test' }],
      allowSkip: true,
      triggerMode: 'on_request',
    };

    it('should return false for undefined value', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core'],
        property: {},
      };
      expect(isSlotSatisfied(testSlot, specDraft)).toBe(false);
    });

    it('should return true for set value', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core'],
        property: { propertyType: 'house' },
      };
      expect(isSlotSatisfied(testSlot, specDraft)).toBe(true);
    });

    it('should return false for empty string', () => {
      // Create a proper test object with empty string
      const testSpec = { activeModules: ['core'], property: { propertyType: '' } };
      const slot = { ...testSlot };
      expect(isSlotSatisfied(slot, testSpec as unknown as SystemSpecDraft)).toBe(false);
    });

    it('should return true for null value (valid "don\'t know" response)', () => {
      // Create a proper test object with null value
      const testSpec = { activeModules: ['core'], property: { propertyType: null } };
      expect(isSlotSatisfied(testSlot, testSpec as unknown as SystemSpecDraft)).toBe(true);
    });
  });

  describe('scoreSlot', () => {
    const criticalSlot: SurveySlot = {
      id: 'test.critical',
      module: 'core',
      topic: 'fabric',
      path: 'test.path',
      priority: 'critical',
      question: 'Critical question?',
      chipOptions: [],
      allowSkip: true,
      triggerMode: 'on_request',
    };

    const importantSlot: SurveySlot = {
      id: 'test.important',
      module: 'core',
      topic: 'boiler',
      path: 'test.path2',
      priority: 'important',
      question: 'Important question?',
      chipOptions: [],
      allowSkip: true,
      triggerMode: 'on_request',
    };

    it('should score critical slots higher than important', () => {
      const criticalScore = scoreSlot(criticalSlot, null);
      const importantScore = scoreSlot(importantSlot, null);
      expect(criticalScore).toBeGreaterThan(importantScore);
    });

    it('should give bonus for matching topic', () => {
      const withTopicMatch = scoreSlot(criticalSlot, 'fabric');
      const withoutTopicMatch = scoreSlot(criticalSlot, 'boiler');
      expect(withTopicMatch).toBeGreaterThan(withoutTopicMatch);
    });
  });

  describe('getNextQuestion', () => {
    it('should return a slot when questions are available', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core', 'central_heating'],
        property: {},
      };
      
      const nextSlot = getNextQuestion(
        specDraft,
        ['core', 'central_heating'],
        'boiler',
        []
      );

      expect(nextSlot).not.toBeNull();
      expect(nextSlot?.question).toBeDefined();
    });

    it('should not return already asked slots', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core', 'central_heating'],
        property: {},
      };

      // Ask all core and central_heating slots
      const allSlotIds = allSurveySlots
        .filter(s => s.module === 'core' || s.module === 'central_heating' || s.module === 'hazards')
        .map(s => s.id);

      const nextSlot = getNextQuestion(
        specDraft,
        ['central_heating'],
        'boiler',
        allSlotIds
      );

      expect(nextSlot).toBeNull();
    });

    it('should not return slots for inactive modules', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core'],
        property: {},
      };

      // Get a question with only core module active
      const nextSlot = getNextQuestion(
        specDraft,
        ['core'] as ModuleName[],
        'boiler',
        []
      );

      // Should not return heat pump or central heating specific slots
      if (nextSlot) {
        expect(['core', 'hazards']).toContain(nextSlot.module);
      }
    });
  });

  describe('calculateModuleCompleteness', () => {
    it('should return 0% for empty spec', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core'],
        property: {},
      };

      const completeness = calculateModuleCompleteness('core', specDraft);
      expect(completeness.filledCritical).toBe(0);
      expect(completeness.percentage).toBeLessThan(100);
    });

    it('should increase percentage as slots are filled', () => {
      const emptySpec: SystemSpecDraft = {
        activeModules: ['core'],
        property: {},
      };

      const partialSpec: SystemSpecDraft = {
        activeModules: ['core'],
        property: {
          propertyType: 'house',
          loftInsulationDepthMm: '250+',
        },
        occupancyPattern: {
          hotWaterProfile: 'medium',
        },
      };

      const emptyCompleteness = calculateModuleCompleteness('core', emptySpec);
      const partialCompleteness = calculateModuleCompleteness('core', partialSpec);

      expect(partialCompleteness.percentage).toBeGreaterThan(emptyCompleteness.percentage);
      expect(partialCompleteness.filledCritical).toBeGreaterThan(emptyCompleteness.filledCritical);
    });
  });

  describe('calculateOverallCompleteness', () => {
    it('should calculate across all active modules', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['core', 'central_heating'],
        property: {},
        centralHeating: {},
      };

      const completeness = calculateOverallCompleteness(specDraft, ['core', 'central_heating']);

      expect(completeness.modules.length).toBeGreaterThanOrEqual(3); // core + central_heating + hazards
      expect(completeness.overallPercentage).toBeDefined();
      expect(completeness.readyToQuote).toBe(false); // Nothing filled
    });

    it('should include warnings when appropriate', () => {
      const specDraft: SystemSpecDraft = {
        activeModules: ['heat_pump', 'hazards'],
        heatPump: {
          electrical: {
            mainFuseOkForHPAndRest: 'upgrade_required',
          },
        },
        hazards: {
          asbestos: {
            monkeyMuckObserved: 'suspected',
          },
        },
      };

      const completeness = calculateOverallCompleteness(specDraft, ['heat_pump']);

      expect(completeness.warnings.length).toBeGreaterThan(0);
      expect(completeness.warnings.some(w => w.includes('DNO'))).toBe(true);
      expect(completeness.warnings.some(w => w.includes('asbestos'))).toBe(true);
    });
  });

  describe('createEmptySpecDraft', () => {
    it('should create spec with correct active modules', () => {
      const spec = createEmptySpecDraft(123, ['core', 'central_heating', 'heat_pump']);

      expect(spec.sessionId).toBe(123);
      expect(spec.activeModules).toEqual(['core', 'central_heating', 'heat_pump']);
      expect(spec.centralHeating).toBeDefined();
      expect(spec.heatPump).toBeDefined();
      expect(spec.solarPv).toBeUndefined();
      expect(spec.ev).toBeUndefined();
    });

    it('should always include hazards section', () => {
      const spec = createEmptySpecDraft(456, ['core']);

      expect(spec.hazards).toBeDefined();
      expect(spec.hazards?.asbestos).toBeDefined();
    });

    it('should create empty nested objects for active modules', () => {
      const spec = createEmptySpecDraft(789, ['pv', 'ev']);

      expect(spec.solarPv?.roofUse).toBeDefined();
      expect(spec.solarPv?.electricalIntegration).toBeDefined();
      expect(spec.ev?.parking).toBeDefined();
      expect(spec.ev?.electricalCapacity).toBeDefined();
    });
  });

  describe('checkPreconditions', () => {
    it('should return true for slots without preconditions', () => {
      const slot: SurveySlot = {
        id: 'test',
        module: 'core',
        topic: 'fabric',
        path: 'test',
        priority: 'important',
        question: 'Test?',
        chipOptions: [],
        allowSkip: true,
        triggerMode: 'on_request',
      };

      const specDraft: SystemSpecDraft = { activeModules: ['core'] };
      expect(checkPreconditions(slot, specDraft)).toBe(true);
    });

    it('should check equals precondition', () => {
      const slot: SurveySlot = {
        id: 'test',
        module: 'core',
        topic: 'fabric',
        path: 'test',
        priority: 'important',
        question: 'Test?',
        chipOptions: [],
        allowSkip: true,
        triggerMode: 'on_request',
        preconditions: [{ path: 'property.propertyType', operator: 'equals', value: 'house' }],
      };

      const matchingSpec: SystemSpecDraft = {
        activeModules: ['core'],
        property: { propertyType: 'house' },
      };
      const nonMatchingSpec: SystemSpecDraft = {
        activeModules: ['core'],
        property: { propertyType: 'flat' },
      };

      expect(checkPreconditions(slot, matchingSpec)).toBe(true);
      expect(checkPreconditions(slot, nonMatchingSpec)).toBe(false);
    });
  });

  describe('allSurveySlots catalog', () => {
    it('should have slots for all modules', () => {
      const modules = new Set(allSurveySlots.map(s => s.module));
      
      expect(modules.has('core')).toBe(true);
      expect(modules.has('central_heating')).toBe(true);
      expect(modules.has('heat_pump')).toBe(true);
      expect(modules.has('pv')).toBe(true);
      expect(modules.has('ev')).toBe(true);
      expect(modules.has('hazards')).toBe(true);
    });

    it('should have unique IDs for all slots', () => {
      const ids = allSurveySlots.map(s => s.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid chip options for all slots', () => {
      for (const slot of allSurveySlots) {
        expect(slot.chipOptions.length).toBeGreaterThan(0);
        for (const chip of slot.chipOptions) {
          expect(chip.label).toBeDefined();
          expect(typeof chip.label).toBe('string');
        }
      }
    });

    it('should have the monkey muck hazard slot', () => {
      const monkeyMuckSlot = allSurveySlots.find(s => s.id === 'haz.asbestos.monkey_muck');
      
      expect(monkeyMuckSlot).toBeDefined();
      expect(monkeyMuckSlot?.triggerMode).toBe('rare_hazard');
      expect(monkeyMuckSlot?.priority).toBe('critical');
    });
  });
});

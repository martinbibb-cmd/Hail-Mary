/**
 * Tests for System Recommendation Exclusion Logic
 *
 * Tests the "show but explain why not" approach for unsuitable heating systems
 */

import { describe, it, expect } from 'vitest';
import { computeSystemRecommendation, type SystemRecInput } from '../systemRecommendation';

describe('System Recommendation Exclusions', () => {
  describe('Combi Boiler Exclusions', () => {
    it('should exclude combi for 3+ bathrooms', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        occupants: 5,
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.exclusionReason).toContain('3 bathrooms');
      expect(combiOption?.exclusionReason).toContain('36 L/min');
      expect(combiOption?.confidence).toBeLessThan(20);
    });

    it('should exclude combi for low flow rate', () => {
      const input: SystemRecInput = {
        propertyType: 'terraced',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        flowRate: 10, // Too low
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.exclusionReason).toContain('flow rate');
      expect(combiOption?.exclusionReason).toContain('10 L/min');
    });

    it('should exclude combi for low mains pressure', () => {
      const input: SystemRecInput = {
        propertyType: 'terraced',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        mainsPressure: 1.2, // Too low
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.exclusionReason).toContain('pressure');
      expect(combiOption?.exclusionReason).toContain('1.2 bar');
    });

    it('should exclude combi for 5+ occupants', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 4,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        occupants: 6,
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.exclusionReason).toContain('6 occupants');
      expect(combiOption?.exclusionReason).toContain('hot water demand');
    });

    it('should NOT exclude combi for suitable scenarios', () => {
      const input: SystemRecInput = {
        propertyType: 'flat',
        bedrooms: 2,
        bathrooms: 1,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        occupants: 2,
        flowRate: 16,
        mainsPressure: 2.0,
      };

      const result = computeSystemRecommendation(input);
      const combiOption = [result.primaryRecommendation, ...result.alternatives].find(
        r => r.id === 'gas-combi-boiler'
      );

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBeFalsy();
    });
  });

  describe('Storage Combi Exclusions', () => {
    it('should exclude storage combi for 3+ bathrooms', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const result = computeSystemRecommendation(input);
      const storageCombi = result.alternatives.find(r => r.id === 'gas-storage-combi');

      // Storage combi only appears for 2 bathrooms, so it won't be in the list
      // But if it were, it would be excluded
      expect(storageCombi).toBeUndefined();
    });

    it('should show storage combi for 2 bathrooms (not excluded)', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        flowRate: 16,
      };

      const result = computeSystemRecommendation(input);
      const storageCombi = result.alternatives.find(r => r.id === 'gas-storage-combi');

      expect(storageCombi).toBeDefined();
      expect(storageCombi?.excluded).toBeFalsy();
    });

    it('should exclude storage combi for low flow rate', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        flowRate: 10,
      };

      const result = computeSystemRecommendation(input);
      const storageCombi = result.alternatives.find(r => r.id === 'gas-storage-combi');

      expect(storageCombi).toBeDefined();
      expect(storageCombi?.excluded).toBe(true);
      expect(storageCombi?.exclusionReason).toContain('flow rate');
    });
  });

  describe('Heat Pump Exclusions', () => {
    it('should exclude heat pump for emergency urgency', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        urgency: 'emergency',
      };

      const result = computeSystemRecommendation(input);
      const heatPump = result.alternatives.find(r => r.id === 'air-source-heat-pump');

      expect(heatPump).toBeDefined();
      expect(heatPump?.excluded).toBe(true);
      expect(heatPump?.exclusionReason).toContain('4-8 weeks');
      expect(heatPump?.exclusionReason).toContain('emergency');
    });

    it('should exclude heat pump for very poor insulation', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        insulationQuality: 1,
      };

      const result = computeSystemRecommendation(input);
      const heatPump = result.alternatives.find(r => r.id === 'air-source-heat-pump');

      expect(heatPump).toBeDefined();
      expect(heatPump?.excluded).toBe(true);
      expect(heatPump?.exclusionReason).toContain('insulation');
      expect(heatPump?.exclusionReason).toContain('45-50°C');
    });

    it('should NOT exclude heat pump for good conditions', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 4,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: false,
        insulationQuality: 4,
        urgency: 'normal',
      };

      const result = computeSystemRecommendation(input);
      const heatPump = [result.primaryRecommendation, ...result.alternatives].find(
        r => r.id === 'air-source-heat-pump'
      );

      expect(heatPump).toBeDefined();
      expect(heatPump?.excluded).toBeFalsy();
    });
  });

  describe('Electric Heating Exclusions', () => {
    it('should exclude electric heating for large properties', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 5,
        bathrooms: 3,
        currentSystem: 'oil_boiler',
        hasGasConnection: false,
      };

      const result = computeSystemRecommendation(input);
      const electric = result.alternatives.find(r => r.id === 'electric-heating');

      expect(electric).toBeDefined();
      expect(electric?.excluded).toBe(true);
      expect(electric?.exclusionReason).toContain('16p/kWh');
      expect(electric?.exclusionReason).toContain('6p/kWh');
    });

    it('should NOT exclude electric for small properties', () => {
      const input: SystemRecInput = {
        propertyType: 'flat',
        bedrooms: 2,
        bathrooms: 1,
        currentSystem: 'electric',
        hasGasConnection: false,
      };

      const result = computeSystemRecommendation(input);
      const electric = result.alternatives.find(r => r.id === 'electric-heating');

      expect(electric).toBeDefined();
      expect(electric?.excluded).toBeFalsy();
    });
  });

  describe('Mixergy Integration', () => {
    it('should include Mixergy option when requested', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        considerMixergy: true,
      };

      const result = computeSystemRecommendation(input);
      const systemBoiler = [result.primaryRecommendation, ...result.alternatives].find(
        r => r.id === 'gas-system-boiler'
      );

      expect(systemBoiler).toBeDefined();
      expect(systemBoiler?.title).toContain('Mixergy');
      expect(systemBoiler?.benefits).toContain('Mixergy smart heating: only heat water you need');
      expect(systemBoiler?.benefits).toContain('30-40% energy savings vs traditional cylinder');
    });

    it('should use traditional cylinder when Mixergy not requested', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        considerMixergy: false,
      };

      const result = computeSystemRecommendation(input);
      const systemBoiler = [result.primaryRecommendation, ...result.alternatives].find(
        r => r.id === 'gas-system-boiler'
      );

      expect(systemBoiler).toBeDefined();
      expect(systemBoiler?.title).toContain('Unvented');
      expect(systemBoiler?.title).not.toContain('Mixergy');
    });

    it('should calculate lower running costs with Mixergy', () => {
      const withMixergy: SystemRecInput = {
        propertyType: 'large',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        considerMixergy: true,
      };

      const withoutMixergy: SystemRecInput = {
        ...withMixergy,
        considerMixergy: false,
      };

      const resultWith = computeSystemRecommendation(withMixergy);
      const resultWithout = computeSystemRecommendation(withoutMixergy);

      const systemBoilerWith = [resultWith.primaryRecommendation, ...resultWith.alternatives].find(
        r => r.id === 'gas-system-boiler'
      );
      const systemBoilerWithout = [resultWithout.primaryRecommendation, ...resultWithout.alternatives].find(
        r => r.id === 'gas-system-boiler'
      );

      expect(systemBoilerWith?.annualRunningCost).toBeLessThan(
        systemBoilerWithout?.annualRunningCost || 0
      );
    });
  });

  describe('Exclusion Display', () => {
    it('should include exclusionReason in considerations', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.considerations[0]).toContain('❌ Not suitable');
      expect(combiOption?.considerations[0]).toBe(combiOption?.exclusionReason);
    });

    it('should preserve original score for excluded options', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const result = computeSystemRecommendation(input);
      const combiOption = result.alternatives.find(r => r.id === 'gas-combi-boiler');

      expect(combiOption).toBeDefined();
      expect(combiOption?.excluded).toBe(true);
      expect(combiOption?.originalScore).toBeGreaterThan(70);
      expect(combiOption?.confidence).toBeLessThan(20);
    });

    it('should sort excluded options to bottom', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 4,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        urgency: 'emergency',
        insulationQuality: 1,
      };

      const result = computeSystemRecommendation(input);
      const allOptions = [result.primaryRecommendation, ...result.alternatives];

      // Check that non-excluded options come before excluded ones
      const firstExcludedIndex = allOptions.findIndex(opt => opt.excluded);
      const lastNonExcludedIndex = allOptions.map((opt, i) => opt.excluded ? -1 : i)
        .reduce((max, i) => Math.max(max, i), -1);

      if (firstExcludedIndex !== -1 && lastNonExcludedIndex !== -1) {
        expect(firstExcludedIndex).toBeGreaterThan(lastNonExcludedIndex);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields gracefully', () => {
      const input: SystemRecInput = {
        propertyType: 'terraced',
        bedrooms: 3,
        bathrooms: 2,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
        // No occupants, flowRate, mainsPressure, urgency
      };

      const result = computeSystemRecommendation(input);

      expect(result).toBeDefined();
      expect(result.primaryRecommendation).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should handle all exclusion criteria at once', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 5,
        bathrooms: 4,
        currentSystem: 'oil_boiler',
        hasGasConnection: true,
        occupants: 7,
        flowRate: 8,
        mainsPressure: 1.0,
        urgency: 'emergency',
        insulationQuality: 1,
      };

      const result = computeSystemRecommendation(input);

      // Should still return options, but many will be excluded
      expect(result).toBeDefined();
      expect(result.primaryRecommendation).toBeDefined();

      const excludedCount = [result.primaryRecommendation, ...result.alternatives]
        .filter(opt => opt.excluded).length;

      expect(excludedCount).toBeGreaterThan(0);
    });
  });
});

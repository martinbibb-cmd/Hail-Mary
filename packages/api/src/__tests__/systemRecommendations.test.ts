/**
 * Tests for System Recommendations API
 */

import {
  SystemRecInput,
  computeSystemRecommendation,
  RULESET_VERSION,
} from '@hail-mary/shared';

describe('System Recommendation Engine', () => {
  describe('computeSystemRecommendation', () => {
    it('should generate a gas boiler recommendation when gas is available', () => {
      const input: SystemRecInput = {
        propertyType: 'semi_detached',
        bedrooms: 3,
        bathrooms: 1,
        currentSystem: 'gas_boiler',
        systemAge: 15,
        hasGasConnection: true,
        annualHeatingCost: 1200,
        insulationQuality: 3,
      };

      const output = computeSystemRecommendation(input);

      expect(output).toBeDefined();
      expect(output.rulesetVersion).toBe(RULESET_VERSION);
      expect(output.primaryRecommendation).toBeDefined();
      expect(output.primaryRecommendation.title).toContain('Gas');
      expect(output.alternatives.length).toBeGreaterThan(0);
      expect(output.estimatedPropertySize).toBe('medium');
    });

    it('should recommend heat pump as primary when no gas connection', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 4,
        bathrooms: 2,
        currentSystem: 'oil_boiler',
        systemAge: 20,
        hasGasConnection: false,
        annualHeatingCost: 1800,
        insulationQuality: 4,
      };

      const output = computeSystemRecommendation(input);

      expect(output).toBeDefined();
      expect(output.primaryRecommendation.systemType).toBe('heat_pump');
      expect(output.primaryRecommendation.grants).toContain('Boiler Upgrade Scheme (£7,500)');
      expect(output.estimatedPropertySize).toBe('large');
    });

    it('should include system boiler for larger properties with gas', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 5,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        systemAge: 12,
        hasGasConnection: true,
        annualHeatingCost: 2000,
      };

      const output = computeSystemRecommendation(input);

      expect(output).toBeDefined();
      expect(output.estimatedPropertySize).toBe('very_large');
      
      // Should have system boiler as an alternative
      const systemBoiler = output.alternatives.find(
        (alt) => alt.id === 'gas-system-boiler'
      );
      expect(systemBoiler).toBeDefined();
    });

    it('should generate appropriate insights', () => {
      const input: SystemRecInput = {
        propertyType: 'flat',
        bedrooms: 2,
        bathrooms: 1,
        currentSystem: 'electric',
        systemAge: 18,
        hasGasConnection: false,
        annualHeatingCost: 1500,
        insulationQuality: 2,
      };

      const output = computeSystemRecommendation(input);

      expect(output.insights.length).toBeGreaterThan(0);
      
      // Should mention age of system
      const ageInsight = output.insights.find((insight) =>
        insight.includes('18 years old')
      );
      expect(ageInsight).toBeDefined();
      
      // Should mention insulation
      const insulationInsight = output.insights.find((insight) =>
        insight.toLowerCase().includes('insulation')
      );
      expect(insulationInsight).toBeDefined();
    });

    it('should calculate costs based on property size', () => {
      const smallInput: SystemRecInput = {
        propertyType: 'flat',
        bedrooms: 1,
        bathrooms: 1,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const largeInput: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 5,
        bathrooms: 3,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const smallOutput = computeSystemRecommendation(smallInput);
      const largeOutput = computeSystemRecommendation(largeInput);

      // Larger property should have higher costs
      expect(largeOutput.primaryRecommendation.estimatedCost.low).toBeGreaterThan(
        smallOutput.primaryRecommendation.estimatedCost.low
      );
    });

    it('should include next steps', () => {
      const input: SystemRecInput = {
        propertyType: 'terraced',
        bedrooms: 3,
        bathrooms: 1,
        currentSystem: 'gas_boiler',
        hasGasConnection: true,
      };

      const output = computeSystemRecommendation(input);

      expect(output.nextSteps.length).toBeGreaterThan(0);
      expect(output.nextSteps[0]).toContain('survey');
    });
  });

  describe('Edge cases', () => {
    it('should handle minimal input', () => {
      const input: SystemRecInput = {
        propertyType: 'flat',
        bedrooms: 1,
        bathrooms: 1,
        currentSystem: 'none',
        hasGasConnection: false,
      };

      const output = computeSystemRecommendation(input);

      expect(output).toBeDefined();
      expect(output.primaryRecommendation).toBeDefined();
    });

    it('should handle very large properties', () => {
      const input: SystemRecInput = {
        propertyType: 'detached',
        bedrooms: 7,
        bathrooms: 4,
        currentSystem: 'oil_boiler',
        hasGasConnection: false,
      };

      const output = computeSystemRecommendation(input);

      expect(output).toBeDefined();
      expect(output.estimatedPropertySize).toBe('very_large');
    });
  });
});

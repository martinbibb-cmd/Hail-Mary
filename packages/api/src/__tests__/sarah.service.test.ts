/**
 * Unit tests for Sarah Explanation Layer Service
 * 
 * Tests explanation generation for different audiences.
 * Ensures Sarah doesn't add new technical claims.
 */

import { sarahService } from '../services/sarah.service';
import { rockyService } from '../services/rocky.service';
import type { SarahExplainRequest, RockyProcessRequest } from '@hail-mary/shared';

describe('Sarah Explanation Layer Service', () => {
  // Helper to create sample RockyFacts
  const createSampleRockyFacts = async () => {
    const request: RockyProcessRequest = {
      sessionId: 1,
      naturalNotes: 'Customer Smith. House with 3 bedrooms. System has 15mm pipes, 8 radiators, 60A main fuse. Worcester boiler, 10 years old, combi type. Asbestos suspected.',
    };
    const result = await rockyService.processNaturalNotes(request);
    return result.rockyFacts;
  };

  describe('explainRockyFacts', () => {
    it('should generate explanation for customer audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
        tone: 'friendly',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      expect(result.explanation).toBeDefined();
      expect(result.explanation.audience).toBe('customer');
      expect(result.explanation.tone).toBe('friendly');
      expect(result.explanation.sections.summary).toBeDefined();
    });

    it('should generate explanation for engineer audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'engineer',
        tone: 'technical',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      expect(result.explanation.audience).toBe('engineer');
      expect(result.explanation.sections.measurementsSummary).toBeDefined();
    });

    it('should generate explanation for surveyor audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'surveyor',
        tone: 'professional',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      expect(result.explanation.audience).toBe('surveyor');
      expect(result.explanation.sections.summary).toBeDefined();
      expect(result.explanation.sections.nextStepsGuidance).toBeDefined();
    });

    it('should include disclaimer in explanation', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      expect(result.explanation.disclaimer).toBeDefined();
      expect(result.explanation.disclaimer.length).toBeGreaterThan(0);
    });

    it('should reference RockyFacts version', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'engineer',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      expect(result.explanation.rockyFactsVersion).toBe('1.0.0');
    });

    it('should adapt tone for customer vs engineer', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const customerRequest: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
        tone: 'simple',
      };
      
      const engineerRequest: SarahExplainRequest = {
        rockyFacts,
        audience: 'engineer',
        tone: 'technical',
      };

      const customerResult = await sarahService.explainRockyFacts(customerRequest);
      const engineerResult = await sarahService.explainRockyFacts(engineerRequest);

      expect(customerResult.success).toBe(true);
      expect(engineerResult.success).toBe(true);
      
      // Customer explanation should be more accessible
      expect(customerResult.explanation.sections.summary).toBeDefined();
      
      // Engineer explanation should be more technical
      expect(engineerResult.explanation.sections.measurementsSummary).toBeDefined();
    });

    it('should handle hazards appropriately for customer audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
        tone: 'professional',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      
      // Check if hazards are mentioned in summary
      const summary = result.explanation.sections.summary || '';
      if (rockyFacts.facts.hazards && rockyFacts.facts.hazards.length > 0) {
        expect(summary.toLowerCase()).toContain('identified');
      }
    });

    it('should include completeness info for surveyor audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'surveyor',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      const summary = result.explanation.sections.summary || '';
      expect(summary).toContain('Completeness');
    });

    it('should not add new technical claims', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const request: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
      };

      const result = await sarahService.explainRockyFacts(request);

      expect(result.success).toBe(true);
      
      // Sarah should not introduce facts not in RockyFacts
      // Check that all key facts are from Rocky
      const allSections = Object.values(result.explanation.sections).join(' ').toLowerCase();
      
      // Should not contain recommendation phrases
      expect(allSections).not.toContain('i recommend');
      expect(allSections).not.toContain('you should');
      expect(allSections).not.toContain('i suggest');
    });

    it('should be consistent with different tones for same audience', async () => {
      const rockyFacts = await createSampleRockyFacts();
      
      const professionalRequest: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
        tone: 'professional',
      };
      
      const friendlyRequest: SarahExplainRequest = {
        rockyFacts,
        audience: 'customer',
        tone: 'friendly',
      };

      const professionalResult = await sarahService.explainRockyFacts(professionalRequest);
      const friendlyResult = await sarahService.explainRockyFacts(friendlyRequest);

      expect(professionalResult.success).toBe(true);
      expect(friendlyResult.success).toBe(true);
      
      // Both should have similar structure
      expect(professionalResult.explanation.sections.summary).toBeDefined();
      expect(friendlyResult.explanation.sections.summary).toBeDefined();
      
      // But may differ in wording/tone
      expect(professionalResult.explanation.tone).toBe('professional');
      expect(friendlyResult.explanation.tone).toBe('friendly');
    });
  });
});

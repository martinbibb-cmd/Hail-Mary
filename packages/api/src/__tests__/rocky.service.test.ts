/**
 * Unit tests for Rocky Logic Engine Service
 * 
 * Tests deterministic fact extraction and derivation.
 * NO LLM usage - pure rule-based testing.
 */

import { rockyService } from '../services/rocky.service';
import type { RockyProcessRequest } from '@hail-mary/shared';

describe('Rocky Logic Engine Service', () => {
  describe('processNaturalNotes', () => {
    it('should extract pipe sizes from transcript', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'The system has 15mm and 22mm copper pipes running throughout.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.facts.measurements?.pipeSize).toBe('15mm');
    });

    it('should normalize pipe size formats', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Pipes are fifteen mm and twenty-two mm.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      const automaticNotes = result.automaticNotes;
      expect(automaticNotes.sections.measurementsAndSizes).toContain('15mm');
    });

    it('should extract materials from transcript', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Need to install a new boiler, 3 radiators, and a magnetic filter.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.facts.materials).toBeDefined();
      expect(result.rockyFacts.facts.materials?.length).toBeGreaterThan(0);
      
      const materialNames = result.rockyFacts.facts.materials?.map(m => m.name) || [];
      expect(materialNames).toContain('boiler');
      expect(materialNames).toContain('radiator');
      expect(materialNames).toContain('filter');
    });

    it('should extract hazards with severity', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Warning: asbestos suspected in boiler cupboard. System condemned.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.facts.hazards).toBeDefined();
      expect(result.rockyFacts.facts.hazards?.length).toBeGreaterThan(0);
      
      const asbestosHazard = result.rockyFacts.facts.hazards?.find(h => h.type === 'asbestos');
      expect(asbestosHazard).toBeDefined();
      expect(asbestosHazard?.severity).toBe('high');
    });

    it('should calculate completeness scores', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Customer Jones. 15mm pipes. Boiler is 10 years old.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.completeness).toBeDefined();
      expect(result.rockyFacts.completeness.overall).toBeGreaterThanOrEqual(0);
      expect(result.rockyFacts.completeness.overall).toBeLessThanOrEqual(100);
    });

    it('should detect missing required data', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Just some general notes about the property.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.missingData).toBeDefined();
      expect(result.rockyFacts.missingData.length).toBeGreaterThan(0);
      
      const requiredMissing = result.rockyFacts.missingData.filter(m => m.required);
      expect(requiredMissing.length).toBeGreaterThan(0);
    });

    it('should generate automatic notes', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'System has 15mm pipes, 8 radiators, and 60A main fuse.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.automaticNotes).toBeDefined();
      expect(result.automaticNotes.sections).toBeDefined();
      expect(result.automaticNotes.sections.measurementsAndSizes).toBeDefined();
      expect(result.automaticNotes.sections.measurementsAndSizes).toContain('15mm');
    });

    it('should generate engineer basics', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'House with 15mm pipes and boiler.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.engineerBasics).toBeDefined();
      expect(result.engineerBasics.basics).toBeDefined();
      expect(result.engineerBasics.basics.pipeSize).toBe('15mm');
    });

    it('should fix common transcription errors', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Found monkey mock on pipes and TRB valves need replacing.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      // Check that hazards contain corrected term
      const hazards = result.rockyFacts.facts.hazards || [];
      const monkeyMuckHazard = hazards.find(h => h.type === 'monkey muck');
      expect(monkeyMuckHazard).toBeDefined();
      
      // Check that materials include valve (normalized from TRB to TRV in extraction)
      const materials = result.rockyFacts.facts.materials || [];
      const valveMaterial = materials.find(m => m.name.toLowerCase().includes('valve'));
      expect(valveMaterial).toBeDefined();
    });

    it('should be deterministic - same input produces same output', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'System with 15mm pipes and 22mm mains.',
      };

      const result1 = await rockyService.processNaturalNotes(request);
      const result2 = await rockyService.processNaturalNotes(request);

      expect(result1.rockyFacts.naturalNotesHash).toBe(result2.rockyFacts.naturalNotesHash);
      expect(result1.rockyFacts.facts.measurements?.pipeSize).toBe(result2.rockyFacts.facts.measurements?.pipeSize);
    });

    it('should include versioned RockyFacts', async () => {
      const request: RockyProcessRequest = {
        sessionId: 1,
        naturalNotes: 'Test transcript.',
      };

      const result = await rockyService.processNaturalNotes(request);

      expect(result.success).toBe(true);
      expect(result.rockyFacts.version).toBe('1.0.0');
      expect(result.automaticNotes.rockyFactsVersion).toBe('1.0.0');
      expect(result.engineerBasics.rockyFactsVersion).toBe('1.0.0');
    });
  });
});

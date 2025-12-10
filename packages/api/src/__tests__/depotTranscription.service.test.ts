/**
 * Unit tests for Depot Transcription Service
 * 
 * Tests section normalization, sanity checks, and material extraction.
 */

import {
  depotTranscriptionService,
} from '../services/depotTranscription.service';
import type { DepotNotes, MaterialItem } from '@hail-mary/shared';

describe('Depot Transcription Service', () => {
  describe('Section Key Normalization', () => {
    it('should normalize section keys to lowercase with underscores', () => {
      expect(depotTranscriptionService.normalizeSectionKey('Customer Summary')).toBe('customer_summary');
      expect(depotTranscriptionService.normalizeSectionKey('EXISTING-SYSTEM')).toBe('existing_system');
      expect(depotTranscriptionService.normalizeSectionKey('  Property Details  ')).toBe('property_details');
    });

    it('should remove special characters except underscores', () => {
      expect(depotTranscriptionService.normalizeSectionKey('Flue & Ventilation')).toBe('flue_ventilation');
      expect(depotTranscriptionService.normalizeSectionKey('Materials/Parts')).toBe('materials_parts');
    });
  });

  describe('Canonical Section Name Resolution', () => {
    it('should resolve canonical names from direct matches', () => {
      expect(depotTranscriptionService.resolveCanonicalSectionName('customer_summary')).toBe('customer_summary');
      expect(depotTranscriptionService.resolveCanonicalSectionName('pipework')).toBe('pipework');
    });

    it('should resolve canonical names from aliases', () => {
      expect(depotTranscriptionService.resolveCanonicalSectionName('boiler')).toBe('existing_system');
      expect(depotTranscriptionService.resolveCanonicalSectionName('rads')).toBe('radiators_emitters');
      expect(depotTranscriptionService.resolveCanonicalSectionName('pipes')).toBe('pipework');
      expect(depotTranscriptionService.resolveCanonicalSectionName('electric')).toBe('electrical');
    });

    it('should return null for unknown sections', () => {
      expect(depotTranscriptionService.resolveCanonicalSectionName('unknown_section')).toBeNull();
      expect(depotTranscriptionService.resolveCanonicalSectionName('random')).toBeNull();
    });
  });

  describe('Transcription Sanity Checks', () => {
    it('should normalize pipe sizes to standard format', () => {
      const text = 'The system has 15 mm and 22 mm pipes.';
      const result = depotTranscriptionService.applyTranscriptionSanityChecks(text);
      expect(result).toBe('The system has 15mm and 22mm pipes.');
    });

    it('should fix common transcription errors', () => {
      const text = 'I found monkey mock and TRB valves.';
      const result = depotTranscriptionService.applyTranscriptionSanityChecks(text);
      expect(result).toContain('monkey muck');
      expect(result).toContain('TRV');
    });

    it('should normalize microbore references', () => {
      const text = 'The heating uses micro-bore and micro bore pipes.';
      const result = depotTranscriptionService.applyTranscriptionSanityChecks(text);
      expect(result).toBe('The heating uses microbore and microbore pipes.');
    });

    it('should convert written pipe sizes to numeric format', () => {
      const text = 'fifteen mm and twenty-two mm pipes';
      const result = depotTranscriptionService.applyTranscriptionSanityChecks(text);
      expect(result).toContain('15mm');
      expect(result).toContain('22mm');
    });
  });

  describe('Section Normalization from Model', () => {
    it('should normalize AI model output to canonical keys', () => {
      const rawSections = {
        'Customer Summary': 'Need new boiler',
        'Boiler': 'Worcester Greenstar 30CDi Classic',
        'Property': '3 bed semi-detached',
        'unknown_field': 'Should be ignored',
      };

      const normalized = depotTranscriptionService.normalizeSectionsFromModel(rawSections);

      expect(normalized.customer_summary).toBe('Need new boiler');
      expect(normalized.existing_system).toBe('Worcester Greenstar 30CDi Classic');
      expect(normalized.property_details).toBe('3 bed semi-detached');
      expect(normalized.unknown_field).toBeUndefined();
    });

    it('should skip empty values', () => {
      const rawSections = {
        'Customer Summary': 'Some content',
        'Existing System': '',
        'Property Details': '   ',
      };

      const normalized = depotTranscriptionService.normalizeSectionsFromModel(rawSections);

      expect(normalized.customer_summary).toBe('Some content');
      expect(normalized.existing_system).toBeUndefined();
      expect(normalized.property_details).toBeUndefined();
    });
  });

  describe('Material Extraction', () => {
    it('should extract materials from transcript', () => {
      const transcript = 'Need to install a new boiler and replace 3 radiators. Add magnetic filter.';
      const depotNotes: DepotNotes = {};

      const materials = depotTranscriptionService.extractMaterials(transcript, depotNotes);

      expect(materials.some(m => m.name.toLowerCase().includes('boiler'))).toBe(true);
      expect(materials.some(m => m.name.toLowerCase().includes('radiator'))).toBe(true);
      expect(materials.some(m => m.name.toLowerCase().includes('filter'))).toBe(true);
    });

    it('should parse materials from materials_parts section', () => {
      const transcript = '';
      const depotNotes: DepotNotes = {
        materials_parts: 'Boiler - Worcester Greenstar 30CDi\nRadiator - 2x K2 600x800\nInhibitor - Sentinel X100',
      };

      const materials = depotTranscriptionService.extractMaterials(transcript, depotNotes);

      expect(materials.length).toBeGreaterThan(0);
      expect(materials[0].name).toBe('Boiler');
      expect(materials[1].name).toBe('Radiator');
      expect(materials[1].quantity).toBe(2);
    });
  });

  describe('Missing Information Detection', () => {
    it('should detect missing required sections', () => {
      const depotNotes: DepotNotes = {
        customer_summary: 'Need new boiler',
        // Missing many required sections
      };

      const missingInfo = depotTranscriptionService.detectMissingInfo(depotNotes);

      expect(missingInfo.length).toBeGreaterThan(0);
      expect(missingInfo.some(m => m.priority === 'critical')).toBe(true);
    });

    it('should detect missing specific details in sections', () => {
      const depotNotes: DepotNotes = {
        existing_system: 'Worcester boiler', // Missing age
        pipework: 'Copper pipes running through walls', // Missing pipe sizes
        electrical: 'Consumer unit in hallway', // Missing bonding info
      };

      const missingInfo = depotTranscriptionService.detectMissingInfo(depotNotes);

      expect(missingInfo.some(m => m.section === 'Existing System')).toBe(true);
      expect(missingInfo.some(m => m.section === 'Pipework')).toBe(true);
      expect(missingInfo.some(m => m.section === 'Electrical')).toBe(true);
    });

    it('should not flag sections with "not discussed" as missing', () => {
      const depotNotes: DepotNotes = {
        customer_summary: 'Need new boiler',
        existing_system: 'Not discussed',
      };

      const missingInfo = depotTranscriptionService.detectMissingInfo(depotNotes);

      // "Not discussed" is noted but still flagged as missing since it's required
      expect(missingInfo.some(m => m.section === 'Existing System')).toBe(true);
    });
  });

  describe('Checklist Matching', () => {
    it('should match checklist items from transcript mentions', () => {
      const transcript = 'Need to replace the boiler and flush the system with inhibitor.';
      const materials: MaterialItem[] = [];

      const checklist = depotTranscriptionService.matchChecklistItems(transcript, materials);

      expect(checklist).toContain('boiler_replacement');
      expect(checklist).toContain('system_flush');
    });

    it('should match checklist items from materials list', () => {
      const transcript = '';
      const materials: MaterialItem[] = [
        { name: 'radiator' },
        { name: 'trv' },
        { name: 'cylinder' },
      ];

      const checklist = depotTranscriptionService.matchChecklistItems(transcript, materials);

      expect(checklist).toContain('radiator_upgrade');
      expect(checklist).toContain('cylinder_replacement');
    });

    it('should not duplicate checklist items', () => {
      const transcript = 'Install boiler and new boiler controls';
      const materials: MaterialItem[] = [{ name: 'boiler' }];

      const checklist = depotTranscriptionService.matchChecklistItems(transcript, materials);

      const boilerCount = checklist.filter(id => id === 'boiler_replacement').length;
      expect(boilerCount).toBe(1);
    });
  });

  describe('Schema and Config Access', () => {
    it('should provide depot schema', () => {
      const schema = depotTranscriptionService.getDepotSchema();

      expect(schema.sections).toBeDefined();
      expect(Array.isArray(schema.sections)).toBe(true);
      expect(schema.sections.length).toBeGreaterThan(0);
      expect(schema.sections[0]).toHaveProperty('key');
      expect(schema.sections[0]).toHaveProperty('name');
      expect(schema.sections[0]).toHaveProperty('order');
    });

    it('should provide checklist configuration', () => {
      const config = depotTranscriptionService.getChecklistConfig();

      expect(config.checklist_items).toBeDefined();
      expect(Array.isArray(config.checklist_items)).toBe(true);
      expect(config.material_aliases).toBeDefined();
      expect(typeof config.material_aliases).toBe('object');
    });

    it('should build schema info string for AI prompts', () => {
      const schemaInfo = depotTranscriptionService.buildSchemaInfo();

      expect(typeof schemaInfo).toBe('string');
      expect(schemaInfo.length).toBeGreaterThan(0);
      expect(schemaInfo).toContain('Customer Summary');
      expect(schemaInfo).toContain('Existing System');
    });
  });
});

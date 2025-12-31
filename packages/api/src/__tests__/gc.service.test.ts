/**
 * Tests for GC Service
 */

import { calculateQualityScore } from '../services/gc.service';
import type { BoilerGcCatalog, BoilerGcSource } from '@hail-mary/shared';

describe('GC Service', () => {
  describe('calculateQualityScore', () => {
    test('should return high score for complete catalog with high confidence sources', () => {
      const catalog: BoilerGcCatalog = {
        id: 'test-1',
        gcNumber: '47-311-19',
        manufacturer: 'Worcester Bosch',
        model: 'Greenstar 4000',
        boilerType: 'combi',
        fuel: 'ng',
        chOutputKwNominal: 25,
        pumpOverrunRequired: true,
        permanentLiveRequired: true,
        firstSeenAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      const sources: BoilerGcSource[] = [
        {
          id: 'source-1',
          gcCatalogId: 'test-1',
          sourceType: 'manufacturer_pdf',
          extractedBy: 'human',
          extractedAt: new Date(),
          confidence: 0.95,
        },
      ];

      const score = calculateQualityScore(catalog, sources);
      expect(score).toBeGreaterThan(0.8);
    });

    test('should return lower score for incomplete catalog', () => {
      const catalog: BoilerGcCatalog = {
        id: 'test-2',
        gcNumber: '78-311-51',
        manufacturer: 'Vaillant',
        // Missing critical fields
        firstSeenAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      const sources: BoilerGcSource[] = [
        {
          id: 'source-2',
          gcCatalogId: 'test-2',
          sourceType: 'manual_entry',
          extractedBy: 'human',
          extractedAt: new Date(),
          confidence: 0.65,
        },
      ];

      const score = calculateQualityScore(catalog, sources);
      expect(score).toBeLessThan(0.5);
    });

    test('should handle catalog with no sources', () => {
      const catalog: BoilerGcCatalog = {
        id: 'test-3',
        gcNumber: '70-311-14',
        manufacturer: 'Ideal',
        model: 'Logic Max',
        boilerType: 'combi',
        fuel: 'ng',
        chOutputKwNominal: 24,
        pumpOverrunRequired: true,
        permanentLiveRequired: true,
        firstSeenAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      const sources: BoilerGcSource[] = [];

      const score = calculateQualityScore(catalog, sources);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    test('should weight critical fields heavily', () => {
      const catalogWithCritical: BoilerGcCatalog = {
        id: 'test-4',
        gcNumber: '47-311-19',
        manufacturer: 'Worcester Bosch',
        model: 'Greenstar 4000',
        boilerType: 'combi',
        fuel: 'ng',
        chOutputKwNominal: 25,
        pumpOverrunRequired: true,
        permanentLiveRequired: true,
        firstSeenAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      const catalogWithoutCritical: BoilerGcCatalog = {
        id: 'test-5',
        gcNumber: '47-311-20',
        manufacturer: 'Worcester Bosch',
        model: 'Greenstar 4000',
        heightMm: 700,
        widthMm: 440,
        depthMm: 360,
        firstSeenAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
      };

      const sources: BoilerGcSource[] = [
        {
          id: 'source-1',
          gcCatalogId: 'test-4',
          sourceType: 'manufacturer_pdf',
          extractedBy: 'human',
          extractedAt: new Date(),
          confidence: 0.9,
        },
      ];

      const scoreWithCritical = calculateQualityScore(catalogWithCritical, sources);
      const scoreWithoutCritical = calculateQualityScore(catalogWithoutCritical, sources);

      expect(scoreWithCritical).toBeGreaterThan(scoreWithoutCritical);
    });
  });
});

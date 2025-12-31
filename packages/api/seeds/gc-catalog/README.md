# GC Boiler Catalog System

This directory contains the GC (Gas Council) boiler catalog system - a "truth layer" for boiler facts keyed by GC number.

## Overview

The GC catalog provides:
- Canonical boiler specifications indexed by GC number
- Confidence-scored field resolution for survey workflows
- Enrichment queue for missing GC numbers
- Provenance tracking for all data sources

## Components

### Database Tables

1. **boiler_gc_catalog** - Core catalog of boiler facts
   - Performance specs (outputs, modulation, ERP)
   - Electrical/controls (pump overrun, permanent live, fuse ratings)
   - Hydraulic (internal pump, diverter, expansion vessel)
   - Physical dimensions and flue specs

2. **boiler_gc_sources** - Provenance tracking
   - Source type (manufacturer PDF, datasheet, manual entry, etc.)
   - Confidence scores
   - Field coverage metadata

3. **boiler_gc_enrichment_queue** - Missing GC workflow
   - Automatic enrichment requests
   - Candidate search results
   - Admin approval workflow

4. **boiler_gc_aliases** - GC number variations
   - Handles different formatting (spaces, hyphens, etc.)
   - Auto-generated on catalog entry creation

### API Endpoints

- `GET /api/gc/:gcNumber` - Retrieve catalog entry
- `POST /api/gc/resolve` - Resolve survey fields with confidence
- `POST /api/gc/enrichment/request` - Request enrichment for missing GC
- `POST /api/gc/enrichment/approve` - Approve enrichment (admin)
- `POST /api/gc/enrichment/reject` - Reject enrichment (admin)
- `GET /api/gc/enrichment/stats` - Get enrichment statistics (admin)

### Services

- **gc.service.ts** - Catalog CRUD operations
- **gc-resolver.service.ts** - Field resolution with confidence scoring
- **gc-enrichment.service.ts** - Enrichment queue management

### Utilities

- **gc-normalize.ts** - GC number normalization and validation

## Data Import

### CSV Format

Import GC catalog data from CSV files:

```bash
cd packages/api
ts-node src/scripts/import-gc-catalog.ts data/gc-seed-top30.csv
```

CSV columns:
- gc_number (required)
- manufacturer, brand, model, variant
- boiler_type (combi|system|regular|unknown)
- fuel (ng|lpg|oil|unknown)
- ch_output_kw, dhw_output_kw
- pump_overrun_required, permanent_live_required (yes/no/true/false)
- overrun_handled_by (boiler|external|unknown)
- typical_fuse_a
- internal_pump_present, internal_diverter_present
- height_mm, width_mm, depth_mm, weight_kg
- flue_diameter_mm
- source_ref, notes

### Seed Data

The initial seed (`gc-seed-top30.csv`) includes 30 common UK boilers:
- Worcester Bosch Greenstar range
- Vaillant ecoTEC and ecoFIT
- Ideal Logic Max and Vogue Max
- Baxi EcoBlue Advance
- Main Eco Elite

## Confidence Scoring

Field source hierarchy (highest to lowest confidence):

1. **GC_CATALOG** (0.95) - From verified GC catalog
2. **IMAGE_OCR_PLATE** (0.85) - OCR from data plate photo
3. **IMAGE_BRAND_FAMILY_RECO** (0.70) - Brand/family recognition
4. **MANUAL_ENGINEER_ENTRY** (0.65) - Engineer manual input
5. **HEURISTIC_FROM_PIPES** (0.55) - Inferred from pipe config
6. **UNKNOWN** (0.00) - No source

## Survey Integration

The resolver service integrates with survey workflows:

1. Engineer enters GC number
2. System looks up in catalog
3. Auto-fills known fields with high confidence
4. Identifies missing critical fields
5. Generates targeted prompts for unknowns
6. Flags install issues (e.g., permanent live required but only 3-core wiring)

## Enrichment Workflow

When a GC number is not found:

1. System creates enrichment queue entry
2. Background worker searches internal docs/manuals
3. Extracts candidate records
4. Admin reviews and approves/rejects
5. Approved entries added to catalog

## Development

### Running Tests

```bash
npm test -- gc
```

### Linting

```bash
npm run lint
```

### Database Migrations

```bash
npm run db:migrate
```

## Future Enhancements

- [ ] Background worker for automatic candidate search
- [ ] OCR integration for data plate extraction
- [ ] Integration with manufacturer APIs
- [ ] Bulk import tools for large datasets
- [ ] Quality score auto-calculation
- [ ] PWA GC Summary Card component
- [ ] GC-first survey prompt flow

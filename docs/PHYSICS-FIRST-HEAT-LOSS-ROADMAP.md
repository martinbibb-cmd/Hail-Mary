# Physics-First Heat Loss Survey System - Implementation Roadmap

## Executive Summary

This roadmap outlines the implementation of Atlas's "Physics-First" heat loss survey system - a professional-grade approach that combines high-tech sensors with traditional engineering tools to deliver unassailable heat loss calculations that beat virtual-only competitors like Stroma and Octopus.

**The Core Principle**: "To beat the likes of Stroma and Octopus, you need to combine the high-tech sensors in the phone with the 'Old School' engineering tools."

## Table of Contents

1. [The "Stroma-Killer" Strategy](#the-stroma-killer-strategy)
2. [Hardware Integration](#hardware-integration)
3. [Data Schema Implementation](#data-schema-implementation)
4. [Physics Calculation Engine](#physics-calculation-engine)
5. [Implementation Phases](#implementation-phases)
6. [Success Metrics](#success-metrics)

---

## The "Stroma-Killer" Strategy

### What Sets Atlas Apart

Traditional virtual survey tools rely on assumptions and table lookups. Atlas uses **ground truth measurements** to create engineering reports that withstand scrutiny:

| Capability | Virtual Apps | Atlas Physics-First |
|------------|--------------|---------------------|
| Room Geometry | Assumptions | LiDAR scanning (mm accuracy) |
| U-Values | Table lookups | Thermal camera + ΔT measurement |
| Cavity Status | Assumed | Boroscope verification |
| Moisture Impact | Ignored | Moisture meter readings |
| Pipe Sizing | Visual guess | Calliper measurements |
| Radiator Output | Nameplate | Calculated at 35°C, 50°C flow temps |

### The "Pro Trick": Measured U-Values

**The Game Changer**: Calculate actual U-values by measuring Temperature Delta (ΔT)

```
Formula: U = Q / (A × ΔT)

If Atlas knows:
- Outside temp (weather API)
- Inside temp (phone sensor)
- Surface temp of wall (thermal camera)

Then Atlas can calculate the actual thermal resistance of that specific wall.
```

This is the "Stroma-Killer" move - you're not guessing from tables, you're measuring reality.

---

## Hardware Integration

### Phase 1: Native Phone Sensors ✅

**Available Now:**
- ✅ LiDAR (iPhone Pro/iPad Pro) - Room geometry
- ✅ Camera - Visual documentation
- ✅ GPS - Location tagging
- ✅ Accelerometer/Gyroscope - Orientation tracking

**Implementation Status:**
- Schema defined ✅
- TypeScript types created ✅
- Database migration ready ✅

### Phase 2: Plugin Thermal Camera 🔄

**Recommended Devices:**
- **FLIR One Pro** ($399)
  - 160x120 thermal resolution
  - -20°C to 400°C range
  - Lightning connector for iPhone
  - MSX image enhancement

- **Seek Thermal Compact Pro** ($499)
  - 320x240 thermal resolution
  - -40°C to 330°C range
  - USB-C for Android
  - Adjustable focus

**Implementation Requirements:**
- [ ] SDK integration for FLIR/Seek
- [ ] Thermal image capture API
- [ ] Temperature point measurement
- [ ] ΔT calculation engine
- [ ] U-value computation from thermal data
- [ ] Overlay thermal images on room scans

**Integration Pattern:**
```typescript
interface ThermalCameraPlugin {
  device: 'FLIR_One_Pro' | 'Seek_Compact_Pro' | 'other';
  captureImage(location: string): Promise<ThermalImage>;
  measureTemperature(x: number, y: number): number;
  calibrate(ambient_temp: number): void;
}
```

### Phase 3: Invasive Inspection Tools 🔄

**Boroscope Integration:**
- **Recommended**: WiFi/USB endoscope camera (£50-150)
- Capture photos/video of cavity walls
- Tag findings to specific walls in 3D model
- Prove cavity insulation status

**Moisture Meter Integration:**
- **Recommended**: Bluetooth-enabled moisture meter
- Log readings against wall IDs
- Adjust U-values based on moisture content
- Flag damp areas for remediation

**Implementation Requirements:**
- [ ] WiFi boroscope stream integration
- [ ] Bluetooth moisture meter pairing
- [ ] Associate findings with wall elements
- [ ] Auto-adjust heat loss calculations for damp

### Phase 4: Manual Measurement Tools ✅

**Already Supported:**
- Callipers (pipe diameter measurement)
- Laser measure (backup for LiDAR)
- Thermometer probes

**Implementation:**
- Schema includes manual measurement fields ✅
- Photo evidence attachment ✅
- Measurement timestamp tracking ✅

---

## Data Schema Implementation

### Completed ✅

1. **Heat Loss Survey Schema** (`heat-loss-survey-schema.json`)
   - ✅ Survey metadata (weather, design conditions)
   - ✅ Property envelope (walls, windows, roof, floor)
   - ✅ Rooms (dimensions, LiDAR scans, orientation)
   - ✅ Emitters (radiators with multi-temp outputs)
   - ✅ System hydraulics (pipes, pump, water quality)
   - ✅ Thermal imaging data
   - ✅ Invasive checks (boroscope, moisture)
   - ✅ Heat loss calculations
   - ✅ Equipment tracking
   - ✅ Recommendations

2. **TypeScript Types** (`heat-loss-survey.types.ts`)
   - ✅ 60+ comprehensive types
   - ✅ Full type safety for survey data
   - ✅ API DTOs for CRUD operations

3. **Database Schema** (`drizzle-schema.ts`)
   - ✅ `heat_loss_surveys` table
   - ✅ JSONB storage for flexibility
   - ✅ Denormalized fields for performance
   - ✅ Indexes for queries

### Database Structure

```sql
CREATE TABLE heat_loss_surveys (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  surveyor_id INTEGER,
  survey_date TIMESTAMP,
  survey_data JSONB,  -- Full schema
  whole_house_heat_loss_w INTEGER,
  recommended_boiler_size_kw NUMERIC,
  calculation_method VARCHAR(50)
);
```

---

## Physics Calculation Engine

### Completed ✅

**Heat Loss Physics Utilities** (`heat-loss-physics.ts`)

#### 1. U-Value Calculations

```typescript
// The "Stroma-Killer" calculation
calculateUValueFromThermalImaging({
  internal_surface_temp_c: 17.5,
  external_surface_temp_c: 4.2,
  internal_air_temp_c: 21.0,
  external_air_temp_c: -3.0,
})
// Returns: { u_value_w_m2k: 1.82, delta_t_surface: 13.3, ... }
```

**Features:**
- ✅ Thermal camera ΔT method
- ✅ Moisture adjustment (5% heat loss increase per 1% moisture)
- ✅ Standard U-value lookup tables as fallback

#### 2. Heat Loss Calculations

```typescript
// Q = U × A × ΔT
calculateHeatLoss({
  u_value: 1.82,
  area_m2: 25.5,
  delta_t: 24  // 21°C internal - (-3°C) external
})
// Returns: { heat_loss_w: 1113 }
```

**Features:**
- ✅ Fabric heat loss
- ✅ Ventilation heat loss (0.33 × n × V × ΔT)
- ✅ Safety margins (default 10%)

#### 3. Radiator Output Calculations

```typescript
// Calculate at multiple flow temperatures
calculateRadiatorOutput({
  panel_type: 'K2',
  height_mm: 600,
  width_mm: 1200,
  flow_temp_c: 45,  // Heat pump temp
  return_temp_c: 35,
  room_temp_c: 21,
})
// Returns: {
//   output_watts: 850,
//   output_at_dt50: 1500,  // Traditional boiler
//   output_at_dt35: 850,   // Heat pump
//   output_at_dt30: 680    // Low temp HP
// }
```

**Features:**
- ✅ EN442 compliant calculations
- ✅ Panel type correction factors (P+, K1, K2, K3)
- ✅ Multi-temperature output (35°C, 50°C flow)
- ✅ Heat pump suitability assessment

---

## Implementation Phases

### Phase 1: Foundation (COMPLETED ✅)

**Deliverables:**
- ✅ JSON Schema definition
- ✅ TypeScript types (60+ types)
- ✅ Database migration
- ✅ Physics calculation utilities
- ✅ Roadmap documentation

**Timeline:** Completed Dec 2025

### Phase 2: API Layer (2 weeks)

**Deliverables:**
- [ ] CRUD endpoints for heat loss surveys
  - `POST /api/heat-loss-surveys` - Create survey
  - `GET /api/heat-loss-surveys/:id` - Get survey
  - `PUT /api/heat-loss-surveys/:id` - Update survey
  - `GET /api/leads/:id/heat-loss-surveys` - List surveys for lead
  - `DELETE /api/heat-loss-surveys/:id` - Delete survey

- [ ] Real-time physics calculations
  - [ ] U-value calculation endpoint
  - [ ] Heat loss calculation endpoint
  - [ ] Radiator output calculation endpoint
  - [ ] Room-by-room heat loss summary

- [ ] Data validation
  - [ ] JSON schema validation on save
  - [ ] Physics constraint checking
  - [ ] Photo evidence verification

**API Example:**
```typescript
// POST /api/heat-loss-surveys
{
  "lead_id": 123,
  "surveyor_id": 45,
  "survey_date": "2025-12-29T10:00:00Z",
  "survey_data": {
    "survey_metadata": { ... },
    "property_envelope": { ... },
    "rooms": [ ... ],
    "emitters": [ ... ]
  }
}

// Response includes calculated fields
{
  "id": 789,
  "whole_house_heat_loss_w": 12500,
  "whole_house_heat_loss_kw": 12.5,
  "recommended_boiler_size_kw": 15,
  "calculation_method": "room_by_room",
  "survey_data": { ... }
}
```

### Phase 3: PWA Survey Interface (4 weeks)

**Week 1: LiDAR Room Capture**
- [ ] LiDAR scanning UI
- [ ] Room dimension capture
- [ ] Volume calculation
- [ ] Photo attachment per room
- [ ] Orientation tagging

**Week 2: Wall & Window Analysis**
- [ ] Wall element creation
- [ ] Window/door measurement
- [ ] Material type selection
- [ ] U-value lookup (with override for thermal camera)
- [ ] Cavity status capture

**Week 3: Thermal Imaging Integration**
- [ ] FLIR One SDK integration
- [ ] Thermal image capture flow
- [ ] Temperature point measurement
- [ ] U-value calculation from ΔT
- [ ] Thermal overlay on 3D model

**Week 4: Hydraulics & Emitters**
- [ ] Radiator measurement (LiDAR assist)
- [ ] Panel type selection (P+, K1, K2, K3)
- [ ] Output calculation at 35°C and 50°C
- [ ] Pipe diameter capture (calliper input)
- [ ] Pump specification entry
- [ ] Water quality assessment

**UI Components:**
- [ ] Survey wizard (step-by-step)
- [ ] 3D room visualization
- [ ] Thermal image viewer
- [ ] Heat loss summary dashboard
- [ ] Radiator suitability checker

### Phase 4: Hardware Accessories Kit (2 weeks)

**"Atlas Professional Kit" White Label:**

Recommended hardware bundle to sell alongside Atlas subscriptions:

| Device | Purpose | Cost | Supplier |
|--------|---------|------|----------|
| FLIR One Pro | Thermal imaging | £399 | FLIR Direct |
| WiFi Boroscope 5m | Cavity inspection | £89 | Amazon/AliExpress |
| Bluetooth Moisture Meter | Damp detection | £59 | Protimeter |
| Digital Callipers | Pipe measurement | £25 | RS Components |
| Laser Distance Meter | Backup measurement | £49 | Bosch |

**Total Bundle Cost:** ~£621
**Suggested Retail:** £799 + Atlas subscription

**Implementation:**
- [ ] Device compatibility testing
- [ ] SDK integration for each device
- [ ] Setup wizard in app
- [ ] Calibration routines
- [ ] Device pairing UI

### Phase 5: Report Generation (2 weeks)

**Professional PDF Output:**

- [ ] MCS-compliant heat loss certificate
- [ ] Room-by-room breakdown
- [ ] Thermal images with annotations
- [ ] Boroscope findings
- [ ] Radiator replacement schedule
- [ ] Heat pump suitability report
- [ ] ROI calculations
- [ ] Before/after comparisons

**Report Sections:**
1. Executive Summary
2. Property Overview
3. Measured U-Values (vs. assumed)
4. Room Heat Loss Breakdown
5. System Hydraulics Analysis
6. Invasive Inspection Findings
7. Recommendations
   - Fabric improvements
   - System upgrades
   - Radiator replacements
8. Heat Pump Readiness Assessment
9. Cost/Benefit Analysis
10. Appendices (thermal images, boroscope photos)

**Export Formats:**
- [ ] PDF (customer-facing)
- [ ] Excel (detailed calculations)
- [ ] JSON (data interchange)

### Phase 6: Advanced Features (4 weeks)

**Week 1: Multi-Property Comparison**
- [ ] Compare heat loss across leads
- [ ] Benchmark against typical values
- [ ] Regional climate adjustments
- [ ] Portfolio heat loss summary

**Week 2: Heat Pump Conversion Planner**
- [ ] Radiator sizing recommendations
- [ ] Flow temperature calculator
- [ ] System volume analysis
- [ ] Heat pump model suggestions
- [ ] Buffer tank requirements

**Week 3: Moisture-Adjusted Calculations**
- [ ] Auto-adjust U-values for damp walls
- [ ] Prioritize damp remediation
- [ ] Calculate heat loss impact of moisture
- [ ] Generate damp investigation reports

**Week 4: Integration & Polish**
- [ ] Integration with quote system
- [ ] Pre-fill product recommendations
- [ ] Historical survey comparison
- [ ] Survey quality scoring

---

## Success Metrics

### Technical Metrics

- [ ] **Accuracy**: U-values within ±10% of lab measurements
- [ ] **Coverage**: 100% of MCS heat loss calculation requirements
- [ ] **Performance**: Survey completion in < 60 minutes
- [ ] **Data Quality**: < 5% missing critical fields

### Business Metrics

- [ ] **Competitive Advantage**: 30% faster survey time vs. Stroma
- [ ] **Quality Perception**: "Engineering-grade" report vs. "estimate"
- [ ] **Conversion Rate**: 40% increase in quote acceptance
- [ ] **Upsell**: 25% of surveys result in heat pump assessment

### User Satisfaction

- [ ] **Surveyor NPS**: > 50
- [ ] **Customer Confidence**: > 90% trust in recommendations
- [ ] **Report Quality**: > 85% rate reports as "professional"

---

## Technical Architecture

### Data Flow

```
1. Surveyor on-site with iPad Pro + FLIR One
   ↓
2. Atlas PWA captures:
   - LiDAR room scans
   - Thermal images (FLIR)
   - Boroscope videos (WiFi)
   - Moisture readings (Bluetooth)
   - Manual measurements (calliper)
   ↓
3. Real-time physics calculations:
   - U-values from ΔT
   - Heat loss per room
   - Radiator output at 35°C/50°C
   - Whole house heat loss
   ↓
4. Generate professional PDF
   ↓
5. Email to customer + save to Lead
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL + JSONB |
| ORM | Drizzle |
| API | Express + TypeScript |
| Frontend | React PWA + Vite |
| Physics Engine | TypeScript utilities |
| LiDAR | RoomPlan API (iOS 16+) |
| Thermal Camera | FLIR SDK / Seek SDK |
| PDF Generation | jsPDF / Puppeteer |
| 3D Visualization | Three.js |

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LiDAR accuracy issues | Medium | Fallback to manual measurement |
| Thermal camera calibration drift | High | Daily calibration routine |
| Boroscope image quality | Low | Multiple insertion points |
| Battery drain | Medium | External battery pack recommendation |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hardware cost barrier | High | Lease/subscription model for kit |
| Surveyor training required | Medium | Video tutorials + certification |
| Customer skepticism | Low | Side-by-side comparison with virtual apps |

---

## Next Steps

### Immediate Actions (Week 1)

1. ✅ Complete schema design
2. ✅ Create TypeScript types
3. ✅ Database migration
4. ✅ Physics calculation utilities
5. [ ] Run database migration on dev environment
6. [ ] Create API endpoints for CRUD operations
7. [ ] Unit tests for physics calculations

### Short Term (Weeks 2-4)

1. [ ] API implementation
2. [ ] Basic PWA survey form
3. [ ] LiDAR integration
4. [ ] Heat loss calculation dashboard

### Medium Term (Weeks 5-12)

1. [ ] FLIR One integration
2. [ ] Boroscope integration
3. [ ] Report generation
4. [ ] Beta testing with select surveyors

### Long Term (Months 4-6)

1. [ ] Professional hardware kit launch
2. [ ] Heat pump conversion planner
3. [ ] Multi-property analytics
4. [ ] AI-powered recommendations

---

## Conclusion

The Physics-First Heat Loss Survey System positions Atlas as the **engineering-grade** solution in a market dominated by virtual estimators. By combining:

- **LiDAR** for millimeter-accurate geometry
- **Thermal cameras** for measured (not assumed) U-values
- **Boroscopes** for cavity verification
- **Moisture meters** for real-world thermal performance
- **Manual tools** for hydraulic system analysis

Atlas delivers **unassailable engineering reports** that win jobs and justify premium pricing.

**The Bottom Line**: Virtual apps guess. Atlas measures.

---

## Appendix A: Compatible Hardware List

### Thermal Cameras

1. **FLIR One Pro** (Recommended)
   - Price: £399
   - Resolution: 160x120
   - Range: -20°C to 400°C
   - Connector: Lightning/USB-C
   - [Buy Link](https://www.flir.com/products/flir-one-pro/)

2. **Seek Thermal Compact Pro**
   - Price: £499
   - Resolution: 320x240
   - Range: -40°C to 330°C
   - Connector: USB-C/Lightning
   - [Buy Link](https://www.thermal.com/)

### Boroscopes

1. **Depstech WiFi Endoscope** (Budget)
   - Price: £89
   - Length: 5m
   - Resolution: 1080P
   - WiFi range: 10m

2. **Ridgid SeeSnake** (Professional)
   - Price: £450
   - Length: 10m
   - Resolution: 1080P
   - Recording capability

### Moisture Meters

1. **Protimeter Surveymaster**
   - Price: £249
   - Bluetooth: Yes
   - Modes: Search, Measure, Humidity

2. **Klein Tools ET140** (Budget)
   - Price: £59
   - Bluetooth: No
   - Simple capacitance meter

---

## Appendix B: Calculation References

### U-Value Calculation Standards

- **BS EN ISO 6946:2017** - Building components and elements - Thermal resistance and transmittance
- **BR 443** - Conventions for U-value calculations
- **MCS 020** - MCS Heat Pump Standard (for heat pump sizing)

### Heat Loss Calculation Standards

- **EN 12831** - Energy performance of buildings - Method for calculation of design heat load
- **MCS Heat Pump Calculator** - Industry standard for UK heat pump sizing

### Radiator Output Standards

- **EN 442** - Radiators and convectors - Technical specifications and requirements
- **CIBSE Guide B** - Heating, ventilating, air conditioning and refrigeration

---

**Document Version:** 1.0
**Last Updated:** 2025-12-29
**Author:** Atlas Development Team
**Status:** Ready for Implementation

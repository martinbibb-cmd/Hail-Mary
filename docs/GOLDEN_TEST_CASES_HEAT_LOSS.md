# Golden Test Cases: Heat Loss Calculations

This document defines golden test cases for validating the Atlas Heat Loss API against known scenarios and edge cases.

## Purpose

Before calling the implementation "production-ready", these test cases should be validated against:
- Internal trusted spreadsheet calculations
- Commercial heat loss tools (e.g., MCS-compliant calculators)
- Known properties with measured heat outputs

## Test Case Categories

### 1. Basic Geometries (Sanity Checks)

#### TC-001: Single Room, Single External Wall
- **Scenario**: Small bedroom with one external wall
- **Inputs**:
  - Room: 3m × 3m × 2.4m (9 m², 21.6 m³)
  - Wall: 3m × 2.4m = 7.2 m² external, U=1.6 W/m²K
  - Design temps: -3°C external, 18°C internal (ΔT = 21K)
  - ACH: 1.0
- **Expected Outputs**:
  - Fabric loss: 7.2 × 1.6 × 21 ≈ 242W
  - Ventilation: 0.33 × 1.0 × 21.6 × 21 ≈ 150W
  - Total (no bridging): ~392W
  - With 10% bridging: ~417W

#### TC-002: Party Wall (Zero ΔT Check)
- **Scenario**: Mid-terrace room with one external, one party wall
- **Inputs**:
  - Room: 4m × 4m × 2.5m (16 m², 40 m³)
  - External wall: 10 m², U=1.6
  - Party wall: 10 m², U=1.0, classification=PARTY_WALL
  - Design temps: -3°C external, 21°C internal
  - ACH: 1.0
- **Expected Outputs**:
  - External wall loss: 10 × 1.6 × 24 = 384W
  - Party wall loss: 10 × 1.0 × 0 = 0W (CRITICAL)
  - Ventilation: 0.33 × 1.0 × 40 × 24 ≈ 317W
  - Total: ~701W

### 2. Edge Cases (Real-World Mess)

#### TC-101: Victorian Terrace (Leaky, High Ceilings)
- **Scenario**: Typical 1890s mid-terrace living room
- **Inputs**:
  - Room: 5m × 4m × 3.2m (20 m², 64 m³)
  - External wall: 16 m², U=2.1 (solid brick, uninsulated)
  - Party walls: 2 × 12.8 m², U=1.0, classification=PARTY_WALL
  - Windows: 3 × 1.5 m², U=5.0 (single glazed)
  - ACH: 2.0 (very leaky)
  - Design temps: -3°C external, 21°C internal
- **Expected Outputs**:
  - Fabric loss (external): 16 × 2.1 × 24 = 806W
  - Fabric loss (windows): 4.5 × 5.0 × 24 = 540W
  - Party wall loss: 0W
  - Ventilation: 0.33 × 2.0 × 64 × 24 ≈ 1,013W
  - Total (no bridging): ~2,359W
  - With 10% bridging: ~2,481W
  - Loss per m²: ~124 W/m² (typical for leaky Victorian)

#### TC-102: Modern Flat (Airtight, Low Ceilings)
- **Scenario**: 2015 new-build apartment
- **Inputs**:
  - Room: 4m × 5m × 2.3m (20 m², 46 m³)
  - External wall: 9.2 m², U=0.35 (insulated)
  - Windows: 2.3 m², U=1.6 (double glazed, argon)
  - Party walls: ceiling, floor, 2 sides = all PARTY_WALL
  - ACH: 0.5 (good airtightness)
  - Design temps: -3°C external, 21°C internal
- **Expected Outputs**:
  - Fabric loss (wall): 9.2 × 0.35 × 24 = 77W
  - Fabric loss (windows): 2.3 × 1.6 × 24 = 88W
  - Party wall/floor/ceiling loss: 0W
  - Ventilation: 0.33 × 0.5 × 46 × 24 ≈ 182W
  - Total: ~347W
  - Loss per m²: ~17 W/m² (typical for modern flat)

#### TC-103: Conservatory Edge Case
- **Scenario**: Large glazed room with huge heat loss
- **Inputs**:
  - Room: 4m × 3m × 2.5m (12 m², 30 m³)
  - Glazing: 25 m², U=2.8 (double glazed, mostly glass)
  - ACH: 1.5 (drafty)
  - Design temps: -3°C external, 21°C internal
- **Expected Outputs**:
  - Fabric loss: 25 × 2.8 × 24 = 1,680W
  - Ventilation: 0.33 × 1.5 × 30 × 24 ≈ 356W
  - Total (no bridging): ~2,036W
  - Loss per m²: ~170 W/m² (very high - typical conservatory)

#### TC-104: Room with Unheated Adjacent (Garage)
- **Scenario**: Bedroom above garage
- **Inputs**:
  - Room: 4m × 3m × 2.4m (12 m², 28.8 m³)
  - External walls: 2 × 7.2 m², U=0.6
  - Floor to garage: 12 m², U=0.7, classification=UNHEATED_ADJACENT
  - Unheated adjacent config: offset_from_external = 5°C
  - Design temps: -3°C external, 18°C bedroom
  - Garage temp: -3 + 5 = 2°C
  - ACH: 0.5
- **Expected Outputs**:
  - External walls: 14.4 × 0.6 × 21 = 182W
  - Floor to garage: 12 × 0.7 × (18 - 2) = 12 × 0.7 × 16 = 134W
  - Ventilation: 0.33 × 0.5 × 28.8 × 21 ≈ 100W
  - Total: ~416W

### 3. Emitter Adequacy Scenarios

#### TC-201: Radiator Adequate for Heat Pump
- **Scenario**: K2 radiator, 600mm × 1200mm
- **Room heat loss**: 800W
- **Expected Outputs**:
  - Output @ 75°C: ~1,728W (adequate)
  - Output @ 55°C: ~1,123W (adequate)
  - Output @ 45°C: ~865W (marginal - 800W + 10% = 880W)
  - Recommended action: upsize

#### TC-202: Undersized Radiator
- **Scenario**: P+ single panel, 600mm × 800mm
- **Room heat loss**: 1,200W
- **Expected Outputs**:
  - Output @ 75°C: ~960W (inadequate)
  - Output @ 55°C: ~624W (inadequate)
  - Output @ 45°C: ~480W (inadequate)
  - Recommended action: replace

### 4. Airtightness n50 Conversions

#### TC-301: Passive House (n50 = 0.6)
- **n50**: 0.6 ACH@50Pa
- **Conversion factor**: 20 (default)
- **Expected ACH**: 0.6 / 20 = 0.03
- **Audit trail should show**: conversion factor, n50 value, derived ACH

#### TC-302: Leaky Victorian (n50 = 15)
- **n50**: 15 ACH@50Pa
- **Conversion factor**: 20
- **Expected ACH**: 15 / 20 = 0.75
- **Audit trail should show**: explicit warning that this is "converted estimate"

#### TC-303: Sheltered Location (custom factor)
- **n50**: 10 ACH@50Pa
- **Conversion factor**: 25 (user override - sheltered)
- **Expected ACH**: 10 / 25 = 0.4
- **Audit trail should show**: custom conversion factor used

### 5. Input Validation Edge Cases

#### TC-401: Negative Dimensions (Should Fail)
- **Room**: -10 m² (negative area)
- **Expected**: ValidationError for floor_area_m2

#### TC-402: Unreasonable Ceiling Height (Should Warn)
- **Room**: 20 m² floor, 200 m³ volume
- **Implied height**: 10m (unrealistic)
- **Expected**: ValidationError for ceiling_height

#### TC-403: Invalid U-value (Should Fail)
- **Wall**: U=0.01 W/m²K (too low, physically impossible)
- **Expected**: ValidationError for u_value

#### TC-404: Invalid Temperature Delta (Should Fail)
- **Design temps**: Internal 15°C, External 20°C
- **Expected**: ValidationError for temperature_difference

#### TC-405: Extreme n50 (Should Warn)
- **n50**: 50 ACH@50Pa (unrealistically leaky)
- **Expected**: ValidationError warning outside typical range

### 6. Ground Floor Scenarios

#### TC-501: Ground Floor Room
- **Scenario**: Living room on ground floor
- **Inputs**:
  - Room: 5m × 4m × 2.5m (20 m², 50 m³)
  - Floor: 20 m², U=0.7, classification=GROUND_FLOOR
  - Ground temp assumption: 10°C
  - Room temp: 21°C
  - ΔT floor: 21 - 10 = 11K
- **Expected Outputs**:
  - Floor loss: 20 × 0.7 × 11 = 154W

## Validation Checklist

Before production deployment, validate:

- [ ] All basic geometries (TC-001 to TC-002) match expected ± 5%
- [ ] Party wall produces exactly 0W loss (TC-002)
- [ ] Edge cases (TC-101 to TC-104) are within ± 10% of trusted calc
- [ ] Emitter adequacy flags are correct (TC-201 to TC-202)
- [ ] n50 conversions are auditable (TC-301 to TC-303)
- [ ] Input validation catches all bad inputs (TC-401 to TC-405)
- [ ] Ground floor ΔT uses 10°C correctly (TC-501)

## Golden Reference Tools

For comparison, use:
- MCS-compliant heat loss calculator (if available)
- EN 12831 spreadsheet implementation
- Internal trusted calculations

## Notes

- Tolerances: ± 5% for simple cases, ± 10% for complex real-world scenarios
- Party wall MUST be exactly 0W (no tolerance)
- All audit trail entries must be present and traceable
- Method metadata must indicate "estimated" when no catalogue data provided

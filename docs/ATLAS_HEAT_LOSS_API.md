# Atlas Heat Loss API (Verified v1.1)

Room-by-room heat loss calculations following MCS 3005-D and BS EN 12831, designed for practical MVP implementation without academic "scope creep".

## Overview

The Atlas Heat Loss API is the "Engineer" module that calculates accurate heat loss figures for properties, focusing on what actually keeps a house warm without the app becoming a liability.

## Key Features

### 1. Data Truth Hierarchy
Every input field supports confidence scoring and source tracking:
- **LIDAR** > **MANUAL** > **SATELLITE** (in terms of accuracy)
- Full audit trail for every assumption
- Transparent for "Sarah" to translate into customer-facing PDF reports

### 2. Critical Party Wall Fix
**IMPORTANT**: Party walls are calculated with **0 ΔT**, not as a percentage discount.

This is the most critical catch from the reality check. Treating a party wall as "negative heat loss" (a discount) is a dangerous shortcut that leads to undersizing heat pumps. The correct engineering approach is treating it as a surface with 0 ΔT (assuming the adjacent space is also heated).

```typescript
// ❌ WRONG: Treating party wall as a discount
totalLoss = externalWallLoss - (partyWallDiscount * 0.1);

// ✅ CORRECT: Party wall contributes 0W
partyWallLoss = U × Area × 0 = 0W
totalLoss = externalWallLoss + 0W;
```

### 3. Surface Classifications
- **EXTERNAL**: Full ΔT (internal - external)
- **PARTY_WALL**: 0 ΔT (heated adjacent space)
- **UNHEATED_ADJACENT**: Partial ΔT (e.g., garage)
- **GROUND_FLOOR**: Ground contact (assumed 10°C year-round)

### 4. Thermal Bridging
Global toggleable uplift factor (default 10%) rather than junction-by-junction psi-values for MVP.

```typescript
thermalBridgingConfig: {
  enabled: true,
  uplift_factor_percent: 10, // Applied to fabric loss
}
```

### 5. Emitter Adequacy (The Killer Feature)
Calculates existing radiator output at various Mean Water Temperatures (MWT):
- **MWT 75°C**: Traditional boiler system (ΔT=50K)
- **MWT 55°C**: Transition/condensing boiler (ΔT=35K)
- **MWT 45°C**: Heat pump compatible (ΔT=30K)

Provides clear flags:
- `adequate_at_mwt_75`: Can it heat the room with a traditional boiler?
- `adequate_at_mwt_55`: Can it work with a modern condensing boiler?
- `adequate_at_mwt_45`: Is it suitable for a heat pump?

Recommended actions:
- `ok`: Radiator is adequate
- `upsize`: Needs a larger radiator
- `major_upsize`: Needs significantly larger radiator
- `replace`: Needs complete replacement or multiple radiators

This tells the customer exactly which radiators need to stay and which need to go.

### 6. Airtightness & Ventilation
Supports multiple input methods:
- **n50 test**: Converts air changes at 50Pa to effective ACH
  ```
  ACH = n50 / conversion_factor (default 20 for normal exposure)
  ```
- **Age band**: Uses typical values for building age
- **Assumed**: Defaults to average UK dwelling (1.0 ACH)

Formula: `Q_vent = 0.33 × ACH × Volume × ΔT`

### 7. Setback & Recovery
User-defined uplift based on occupancy patterns and intermittency:
```typescript
setbackRecoveryConfig: {
  enabled: true,
  uplift_factor_percent: 20, // For intermittent heating
  occupancy_pattern: 'intermittent',
}
```

## API Endpoints

### POST /api/atlas/calculate-heat-loss

Calculate room-by-room heat loss with emitter adequacy checking.

**Request Body:**
```json
{
  "rooms": [
    {
      "room_id": "room-1",
      "name": "Living Room",
      "dimensions": {
        "floor_area_m2": 20,
        "volume_m3": 50
      },
      "design_temp_c": 21
    }
  ],
  "walls": [
    {
      "wall_id": "wall-1",
      "room_id": "room-1",
      "orientation": "N",
      "area_m2": 10,
      "u_value_calculated": 1.6,
      "surface_classification": "EXTERNAL",
      "confidence_score": "medium",
      "source_type": "TABLE_LOOKUP"
    },
    {
      "wall_id": "wall-2",
      "room_id": "room-1",
      "orientation": "E",
      "area_m2": 10,
      "u_value_calculated": 1.6,
      "surface_classification": "PARTY_WALL",
      "confidence_score": "high",
      "source_type": "MANUAL"
    }
  ],
  "emitters": [
    {
      "emitter_id": "rad-1",
      "room_id": "room-1",
      "type": "radiator",
      "radiator_details": {
        "panel_type": "K2",
        "height_mm": 600,
        "width_mm": 1000,
        "depth_mm": 100
      }
    }
  ],
  "designConditions": {
    "design_external_temp_c": -3,
    "desired_internal_temp_c": 21
  },
  "thermalBridgingConfig": {
    "enabled": true,
    "uplift_factor_percent": 10
  },
  "airtightnessConfig": {
    "source": "age_band",
    "age_band": "1965-1980"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "calculation_method": "room_by_room",
    "design_conditions": {
      "design_external_temp_c": -3,
      "desired_internal_temp_c": 21
    },
    "room_heat_losses": [
      {
        "room_id": "room-1",
        "fabric_loss_w": 384,
        "ventilation_loss_w": 396,
        "thermal_bridging_w": 38,
        "setback_recovery_w": 0,
        "total_loss_w": 818,
        "loss_w_per_m2": 41,
        "emitter_adequacy": {
          "emitter_id": "rad-1",
          "room_id": "room-1",
          "room_heat_loss_w": 818,
          "current_output_at_mwt_75": 1600,
          "current_output_at_mwt_55": 1040,
          "current_output_at_mwt_45": 800,
          "adequate_at_mwt_75": true,
          "adequate_at_mwt_55": true,
          "adequate_at_mwt_45": false,
          "recommended_action": "upsize",
          "notes": "Radiator K2, 600x1000mm"
        }
      }
    ],
    "whole_house_heat_loss_w": 818,
    "whole_house_heat_loss_kw": 0.8,
    "heat_loss_per_m2": 41,
    "safety_margin_percent": 10,
    "recommended_boiler_size_kw": 0.9,
    "audit_trail": [
      {
        "field_name": "room_internal_temp_c",
        "value": 21,
        "source_type": "MANUAL",
        "confidence_score": "high",
        "timestamp": "2025-12-30T13:00:00.000Z",
        "notes": "Design internal temp for Living Room"
      },
      {
        "field_name": "surface_delta_t_PARTY_WALL",
        "value": 0,
        "source_type": "ASSUMED",
        "confidence_score": "medium",
        "timestamp": "2025-12-30T13:00:00.000Z",
        "notes": "Party wall: assumes heated adjacent space, ΔT = 0K (prevents undersizing)"
      }
    ]
  }
}
```

### GET /api/atlas/defaults

Get default configuration values for Atlas heat loss calculations.

**Response:**
```json
{
  "success": true,
  "data": {
    "design_conditions": {
      "design_external_temp_c": -3,
      "desired_internal_temp_c": 21
    },
    "thermal_bridging": {
      "default_uplift_percent": 10,
      "note": "Global uplift factor for MVP (not junction-by-junction psi-values)"
    },
    "airtightness": {
      "default_ach": 1.0,
      "n50_conversion_factor": 20,
      "age_bands": {
        "pre-1919": 2.0,
        "1919-1944": 1.5,
        "1945-1964": 1.5,
        "1965-1980": 1.0,
        "1981-1990": 1.0,
        "1991-2002": 0.5,
        "2003-2010": 0.5,
        "2011+": 0.5
      }
    },
    "surface_classifications": [
      "EXTERNAL",
      "PARTY_WALL",
      "UNHEATED_ADJACENT",
      "GROUND_FLOOR"
    ]
  }
}
```

## TypeScript Usage

```typescript
import {
  calculatePropertyHeatLoss,
  calculateRoomHeatLoss,
  ATLAS_DEFAULTS,
} from '@hail-mary/shared';

// Calculate heat loss for entire property
const result = calculatePropertyHeatLoss({
  rooms,
  wallsByRoom: new Map([
    ['room-1', [wall1, wall2]],
    ['room-2', [wall3]],
  ]),
  emittersByRoom: new Map([
    ['room-1', [radiator1]],
  ]),
  designConditions: {
    design_external_temp_c: -3,
    desired_internal_temp_c: 21,
  },
  thermalBridgingConfig: {
    enabled: true,
    uplift_factor_percent: ATLAS_DEFAULTS.THERMAL_BRIDGING_UPLIFT_PERCENT,
  },
  airtightnessConfig: {
    source: 'n50_test',
    n50_value: 10,
    conversion_factor: ATLAS_DEFAULTS.N50_CONVERSION_FACTOR,
  },
});

console.log(`Total heat loss: ${result.whole_house_heat_loss_kw} kW`);
console.log(`Recommended boiler: ${result.recommended_boiler_size_kw} kW`);

// Check emitter adequacy
result.room_heat_losses?.forEach(room => {
  if (room.emitter_adequacy) {
    console.log(`${room.emitter_adequacy.room_id}: ${room.emitter_adequacy.recommended_action}`);
  }
});

// Review audit trail
result.audit_trail?.forEach(entry => {
  console.log(`${entry.field_name}: ${entry.value} (${entry.confidence_score})`);
});
```

## Formulas

### Transmission Loss
```
Q = U × A × ΔT

Where:
- Q = Heat loss (Watts)
- U = Thermal transmittance (W/m²K)
- A = Area (m²)
- ΔT = Temperature difference (K)
```

### Ventilation Loss
```
Q_vent = 0.33 × ACH × V × ΔT

Where:
- Q_vent = Ventilation heat loss (W)
- 0.33 = Specific heat capacity of air (Wh/m³K)
- ACH = Air changes per hour
- V = Volume (m³)
- ΔT = Temperature difference (K)
```

### Thermal Bridging
```
Q_bridging = (Q_fabric × uplift_percent) / 100

Default uplift: 10% of fabric loss
```

### Radiator Output
```
Output = Output_rated × (ΔT_actual / ΔT_rated)^n

Where:
- n = 1.3 (radiator exponent, empirical)
- ΔT_rated = 50K (standard rating condition)
- ΔT_actual = Mean water temp - Room temp
```

## Why This Version is Better

### No Rabbit Holes
Stops you from getting stuck on "Psi-values" or "Passive House math" that doesn't apply to a typical UK property.

### Safety First
By fixing the party wall and thermal bridge logic, the Engineer won't accidentally undersize the heat pump.

### Emitter Focus
The "Emitter Adequacy" is what actually sells the job. It tells the customer exactly which radiators need to stay and which need to go.

### Audit Trail for Sarah
Every assumption is tracked with source, confidence, and timestamp. Sarah (the LLM report generator) can translate this into customer-friendly language:

> "The Engineer assumed your walls are uninsulated because we couldn't get the borescope in, so we've played it safe with the heater size."

## Testing

Comprehensive test suite covers:
- ✅ Party wall logic (0 ΔT, not a discount)
- ✅ Thermal bridging uplift
- ✅ Emitter adequacy at different MWTs
- ✅ Airtightness calculations (n50 conversion)
- ✅ Setback & recovery
- ✅ Audit trail generation
- ✅ Whole property calculations

Run tests:
```bash
cd packages/shared
npm test
```

## Standards Compliance

- **MCS 3005-D**: UK Microgeneration Certification Scheme for heat pump installations
- **BS EN 12831**: European standard for heating system design and heat load calculation
- **UK Building Regulations Part L**: Conservation of fuel and power

## License

Part of the Hail-Mary project.

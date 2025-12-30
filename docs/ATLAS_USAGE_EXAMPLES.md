# Atlas Heat Loss API - Usage Examples

This document provides practical examples of using the Atlas Heat Loss API.

## Example 1: Simple Room Calculation

Calculate heat loss for a single room with one external wall and one party wall.

```typescript
import {
  calculateRoomHeatLoss,
  Room,
  Wall,
  DesignConditions,
} from '@hail-mary/shared';

// Define the room
const livingRoom: Room = {
  room_id: 'living-1',
  name: 'Living Room',
  dimensions: {
    floor_area_m2: 20,
    volume_m3: 50,
  },
  design_temp_c: 21, // Standard living room temperature
};

// External wall (north-facing)
const externalWall: Wall = {
  wall_id: 'wall-ext-1',
  orientation: 'N',
  area_m2: 10,
  u_value_calculated: 1.6, // Typical cavity wall unfilled
  surface_classification: 'EXTERNAL',
  confidence_score: 'medium',
  source_type: 'TABLE_LOOKUP',
};

// Party wall (shared with heated neighbor)
const partyWall: Wall = {
  wall_id: 'wall-party-1',
  orientation: 'E',
  area_m2: 10,
  u_value_calculated: 1.6, // U-value doesn't matter, ΔT = 0
  surface_classification: 'PARTY_WALL',
  confidence_score: 'high',
  source_type: 'MANUAL',
};

// Design conditions
const designConditions: DesignConditions = {
  design_external_temp_c: -3, // UK standard
  desired_internal_temp_c: 21,
};

// Calculate heat loss
const result = calculateRoomHeatLoss({
  room: livingRoom,
  walls: [externalWall, partyWall],
  designConditions,
  thermalBridgingConfig: {
    enabled: true,
    uplift_factor_percent: 10,
  },
  airtightnessConfig: {
    source: 'age_band',
    age_band: '1965-1980', // Average airtightness
  },
});

console.log(`Room: ${livingRoom.name}`);
console.log(`Fabric loss: ${result.roomHeatLoss.fabric_loss_w}W`);
console.log(`Ventilation loss: ${result.roomHeatLoss.ventilation_loss_w}W`);
console.log(`Thermal bridging: ${result.roomHeatLoss.thermal_bridging_w}W`);
console.log(`Total heat loss: ${result.roomHeatLoss.total_loss_w}W`);

// Verify party wall is handled correctly (0W loss)
console.log('\nAudit Trail:');
result.auditTrail.forEach(entry => {
  if (entry.field_name.includes('PARTY_WALL')) {
    console.log(`- ${entry.notes}`);
  }
});
```

**Expected Output:**
```
Room: Living Room
Fabric loss: 384W
Ventilation loss: 396W
Thermal bridging: 38W
Total heat loss: 818W

Audit Trail:
- Party wall: assumes heated adjacent space, ΔT = 0K (prevents undersizing)
```

## Example 2: Room with Emitter Adequacy Check

Calculate whether an existing radiator is suitable for heat pump conversion.

```typescript
import {
  calculateRoomHeatLoss,
  Room,
  Wall,
  Emitter,
  DesignConditions,
} from '@hail-mary/shared';

// Room definition
const bedroom: Room = {
  room_id: 'bed-1',
  name: 'Master Bedroom',
  dimensions: {
    floor_area_m2: 15,
    volume_m3: 37.5,
  },
  design_temp_c: 18, // Bedroom temperature
};

// External walls (poorly insulated)
const wall1: Wall = {
  wall_id: 'bed-wall-1',
  orientation: 'N',
  area_m2: 12,
  u_value_calculated: 2.1, // Solid wall, uninsulated
  surface_classification: 'EXTERNAL',
  confidence_score: 'medium',
  source_type: 'TABLE_LOOKUP',
};

// Existing radiator
const existingRadiator: Emitter = {
  emitter_id: 'rad-bed-1',
  room_id: 'bed-1',
  type: 'radiator',
  radiator_details: {
    panel_type: 'K2', // Double panel, double convector
    height_mm: 600,
    width_mm: 1200,
    depth_mm: 100,
  },
};

const designConditions: DesignConditions = {
  design_external_temp_c: -3,
  desired_internal_temp_c: 18,
};

// Calculate with emitter check
const result = calculateRoomHeatLoss({
  room: bedroom,
  walls: [wall1],
  emitters: [existingRadiator],
  designConditions,
  thermalBridgingConfig: {
    enabled: true,
    uplift_factor_percent: 10,
  },
});

const adequacy = result.roomHeatLoss.emitter_adequacy!;

console.log(`\n${bedroom.name} Emitter Adequacy Report`);
console.log(`=====================================`);
console.log(`Room heat loss: ${adequacy.room_heat_loss_w}W`);
console.log(`\nRadiator Output:`);
console.log(`- At 75°C flow (traditional boiler): ${adequacy.current_output_at_mwt_75}W ${adequacy.adequate_at_mwt_75 ? '✅' : '❌'}`);
console.log(`- At 55°C flow (condensing boiler): ${adequacy.current_output_at_mwt_55}W ${adequacy.adequate_at_mwt_55 ? '✅' : '❌'}`);
console.log(`- At 45°C flow (heat pump): ${adequacy.current_output_at_mwt_45}W ${adequacy.adequate_at_mwt_45 ? '✅' : '❌'}`);
console.log(`\nRecommendation: ${adequacy.recommended_action.toUpperCase()}`);

if (adequacy.recommended_action !== 'ok') {
  console.log(`\n⚠️  This radiator needs to be ${adequacy.recommended_action}d for heat pump compatibility.`);
}
```

**Expected Output:**
```
Master Bedroom Emitter Adequacy Report
=====================================
Room heat loss: 932W

Radiator Output:
- At 75°C flow (traditional boiler): 1920W ✅
- At 55°C flow (condensing boiler): 1248W ✅
- At 45°C flow (heat pump): 960W ✅

Recommendation: OK
```

## Example 3: Whole Property Calculation via API

Use the REST API to calculate heat loss for an entire property.

```javascript
// Example API request
const propertyData = {
  rooms: [
    {
      room_id: 'living-1',
      name: 'Living Room',
      dimensions: {
        floor_area_m2: 20,
        volume_m3: 50,
      },
      design_temp_c: 21,
    },
    {
      room_id: 'kitchen-1',
      name: 'Kitchen',
      dimensions: {
        floor_area_m2: 15,
        volume_m3: 37.5,
      },
      design_temp_c: 21,
    },
    {
      room_id: 'bed-1',
      name: 'Master Bedroom',
      dimensions: {
        floor_area_m2: 15,
        volume_m3: 37.5,
      },
      design_temp_c: 18,
    },
  ],
  walls: [
    {
      wall_id: 'wall-1',
      room_id: 'living-1',
      orientation: 'N',
      area_m2: 10,
      u_value_calculated: 1.6,
      surface_classification: 'EXTERNAL',
    },
    {
      wall_id: 'wall-2',
      room_id: 'living-1',
      orientation: 'E',
      area_m2: 10,
      u_value_calculated: 1.6,
      surface_classification: 'PARTY_WALL',
    },
    {
      wall_id: 'wall-3',
      room_id: 'kitchen-1',
      orientation: 'N',
      area_m2: 8,
      u_value_calculated: 1.6,
      surface_classification: 'EXTERNAL',
    },
    {
      wall_id: 'wall-4',
      room_id: 'bed-1',
      orientation: 'N',
      area_m2: 12,
      u_value_calculated: 2.1,
      surface_classification: 'EXTERNAL',
    },
  ],
  emitters: [
    {
      emitter_id: 'rad-1',
      room_id: 'living-1',
      type: 'radiator',
      radiator_details: {
        panel_type: 'K2',
        height_mm: 600,
        width_mm: 1000,
      },
    },
    {
      emitter_id: 'rad-2',
      room_id: 'kitchen-1',
      type: 'radiator',
      radiator_details: {
        panel_type: 'K2',
        height_mm: 600,
        width_mm: 800,
      },
    },
  ],
  designConditions: {
    design_external_temp_c: -3,
    desired_internal_temp_c: 21,
  },
  thermalBridgingConfig: {
    enabled: true,
    uplift_factor_percent: 10,
  },
  airtightnessConfig: {
    source: 'age_band',
    age_band: '1965-1980',
  },
};

// Make API call
const response = await fetch('/api/atlas/calculate-heat-loss', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify(propertyData),
});

const result = await response.json();

if (result.success) {
  console.log('Property Heat Loss Summary');
  console.log('==========================');
  console.log(`Total heat loss: ${result.data.whole_house_heat_loss_kw} kW`);
  console.log(`Heat loss per m²: ${result.data.heat_loss_per_m2} W/m²`);
  console.log(`Recommended boiler size: ${result.data.recommended_boiler_size_kw} kW`);
  console.log(`(includes ${result.data.safety_margin_percent}% safety margin)`);
  
  console.log('\nRoom Breakdown:');
  result.data.room_heat_losses.forEach(room => {
    console.log(`\n${room.room_id}:`);
    console.log(`  Fabric: ${room.fabric_loss_w}W`);
    console.log(`  Ventilation: ${room.ventilation_loss_w}W`);
    console.log(`  Thermal bridging: ${room.thermal_bridging_w}W`);
    console.log(`  Total: ${room.total_loss_w}W`);
    
    if (room.emitter_adequacy) {
      const status = room.emitter_adequacy.adequate_at_mwt_45 ? '✅ OK' : '❌ NEEDS UPGRADE';
      console.log(`  Emitter: ${status}`);
    }
  });
  
  console.log('\nAudit Trail Highlights:');
  result.data.audit_trail
    .filter(entry => entry.confidence_score === 'low')
    .forEach(entry => {
      console.log(`  ⚠️  ${entry.field_name}: ${entry.notes}`);
    });
}
```

## Example 4: Using n50 Test Results

If you have an airtightness test (n50 value), use it for more accurate calculations.

```typescript
import {
  calculateRoomHeatLoss,
  ATLAS_DEFAULTS,
} from '@hail-mary/shared';

// Airtightness from blower door test
const airtightnessConfig = {
  source: 'n50_test' as const,
  n50_value: 8.5, // Air changes per hour at 50Pa pressure
  conversion_factor: ATLAS_DEFAULTS.N50_CONVERSION_FACTOR, // 20 for normal exposure
  notes: 'Blower door test conducted 2024-12-15',
};

// Calculate effective ACH
// ACH = n50 / conversion_factor = 8.5 / 20 = 0.425

const result = calculateRoomHeatLoss({
  room: myRoom,
  walls: myWalls,
  designConditions: myDesignConditions,
  airtightnessConfig,
});

// The audit trail will show:
// "Airtightness from test: n50=8.5, conversion=20, ACH=0.43"
```

## Example 5: Intermittent Heating with Setback Recovery

For properties with intermittent heating patterns (e.g., heating only in evenings).

```typescript
import { calculatePropertyHeatLoss } from '@hail-mary/shared';

const result = calculatePropertyHeatLoss({
  rooms: myRooms,
  wallsByRoom: myWallsByRoom,
  emittersByRoom: myEmittersByRoom,
  designConditions: {
    design_external_temp_c: -3,
    desired_internal_temp_c: 21,
  },
  thermalBridgingConfig: {
    enabled: true,
    uplift_factor_percent: 10,
  },
  setbackRecoveryConfig: {
    enabled: true,
    uplift_factor_percent: 20, // 20% uplift for intermittent heating
    occupancy_pattern: 'intermittent',
    notes: 'Property heated only 5pm-11pm on weekdays',
  },
});

// Each room will have setback_recovery_w calculated
// This accounts for the extra power needed to reheat the property
```

## Example 6: Comparing Different Scenarios

Compare heat loss with different insulation scenarios.

```typescript
import { calculateRoomHeatLoss } from '@hail-mary/shared';

// Scenario 1: Current state (uninsulated)
const wallUninsulated: Wall = {
  wall_id: 'wall-1',
  orientation: 'N',
  area_m2: 10,
  u_value_calculated: 2.1, // Solid wall, uninsulated
  surface_classification: 'EXTERNAL',
};

const currentResult = calculateRoomHeatLoss({
  room: myRoom,
  walls: [wallUninsulated],
  designConditions: myDesignConditions,
});

// Scenario 2: After insulation
const wallInsulated: Wall = {
  wall_id: 'wall-1',
  orientation: 'N',
  area_m2: 10,
  u_value_calculated: 0.6, // With external wall insulation
  surface_classification: 'EXTERNAL',
};

const insulatedResult = calculateRoomHeatLoss({
  room: myRoom,
  walls: [wallInsulated],
  designConditions: myDesignConditions,
});

const savingsW = currentResult.roomHeatLoss.total_loss_w - insulatedResult.roomHeatLoss.total_loss_w;
const savingsPercent = (savingsW / currentResult.roomHeatLoss.total_loss_w) * 100;

console.log(`Current heat loss: ${currentResult.roomHeatLoss.total_loss_w}W`);
console.log(`With insulation: ${insulatedResult.roomHeatLoss.total_loss_w}W`);
console.log(`Savings: ${savingsW}W (${savingsPercent.toFixed(1)}%)`);
```

## Tips for Integration

### 1. Always Include Audit Trail
The audit trail is essential for transparency and debugging:
```typescript
result.audit_trail?.forEach(entry => {
  if (entry.confidence_score === 'low') {
    // Flag low-confidence assumptions for review
    console.warn(`Low confidence: ${entry.field_name} - ${entry.notes}`);
  }
});
```

### 2. Validate Emitter Adequacy
Check if radiators are suitable before recommending heat pump:
```typescript
const inadequateRooms = result.room_heat_losses
  ?.filter(room => 
    room.emitter_adequacy && 
    !room.emitter_adequacy.adequate_at_mwt_45
  )
  .map(room => room.room_id);

if (inadequateRooms.length > 0) {
  console.warn(`Heat pump not recommended: radiators inadequate in ${inadequateRooms.join(', ')}`);
}
```

### 3. Document Assumptions
Always explain assumptions to customers:
```typescript
const partyWallAssumptions = result.audit_trail
  ?.filter(entry => entry.field_name.includes('PARTY_WALL'))
  .map(entry => entry.notes);

// Show to customer:
// "We assumed your party wall doesn't lose heat because your neighbor's house is also heated."
```

## Next Steps

- See [ATLAS_HEAT_LOSS_API.md](./ATLAS_HEAT_LOSS_API.md) for complete API documentation
- See [IMPLEMENTATION_SUMMARY_ATLAS.md](../IMPLEMENTATION_SUMMARY_ATLAS.md) for implementation details
- Review test suite in `packages/shared/src/utils/__tests__/atlas-heat-loss.test.ts` for more examples

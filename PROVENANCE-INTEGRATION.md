# Provenance End-to-End Integration Plan

## Current State

**Types:** ✅ Clean (no conflicts)
**Provenance foundation:** ✅ Built
**Calculator:** ❌ Not using provenance yet (type conflicts)
**API:** ❌ Not returning provenance yet

## Target Structure

### API Response Shape

```json
POST /api/heating-design/projects/:id/calculate-heat-loss
{
  "results": [
    {
      "roomId": "abc123",
      "fabricLoss": 1500,
      "ventilationLoss": 500,
      "totalLoss": 2000,
      "requiredOutput": 2300,
      "breakdown": {...},

      // NEW: Provenance embedded in result
      "provenance": {
        "method": "EN12831-simplified",
        "methodVersion": "2026.01",
        "inputsSnapshot": {
          "user": {  // What surveyor entered
            "wallConstruction": "cavity_full_fill",
            "targetTemp": 21
          },
          "resolved": {  // What engine actually used
            "wallUValue": 0.35,
            "airChangesPerHour": 1.0,
            "targetTemp": 21,
            "deltaT": 24
          }
        },
        "assumptions": [
          {
            "code": "ACH_UNKNOWN",
            "description": "Air change rate assumed as 1.0 ACH",
            "impact": "medium"
          }
        ],
        "defaultsApplied": [...],
        "warnings": [...],
        "calculatedAt": "2026-01-05T12:00:00Z"
      },

      // OPTIONAL: Computed confidence (not stored)
      "confidence": {
        "overall": "medium",
        "geometry": "high",
        "fabric": "medium",
        "ventilation": "low"
      }
    }
  ],
  "totalLoad": 15000,
  "roomCount": 6
}
```

### Database Storage

```sql
-- Heat loss results table (already has provenance column)
heating_heat_loss_results
  - provenance (jsonb) -- Full CalculationProvenance object
  - breakdown (jsonb)  -- HeatLossBreakdown
  -- other numeric columns for query performance
```

## Implementation Steps

### Step 1: Update Calculator to Return Provenance ✅ (stubbed)

```typescript
// packages/heating-engine/src/heatloss/calculator.ts
export function calculateRoomHeatLoss(...): HeatLossResult {
  // ... existing calculation ...

  // Build provenance
  const provenance = buildHeatLossProvenance(
    room, building, climate, designConditions, result
  );

  return {
    ...result,
    provenance  // Add to result
  };
}
```

### Step 2: Update API to Populate Provenance 🚧 (next)

```typescript
// packages/api/src/routes/heating-design.ts
const results = calculateBuildingHeatLoss(...);

for (const result of results) {
  await db.insert(heatingHeatLossResults).values({
    roomId: result.roomId,
    fabricLoss: result.fabricLoss.toString(),
    // ...
    provenance: result.provenance,  // Store complete audit trail
  });
}

// Return with confidence computed on-demand
res.json({
  results: results.map(r => ({
    ...r,
    confidence: computeConfidence(r.provenance)  // Compute, don't store
  })),
  totalLoad: calculateTotalHeatLoad(results)
});
```

### Step 3: Separate user/resolved inputs 🔜 (future)

```typescript
inputsSnapshot: {
  user: {
    // What the surveyor selected/entered
    wallConstruction: "cavity_full_fill",
    targetTemp: 21,
    // ...
  },
  resolved: {
    // What the engine actually used after lookups
    wallUValue: 0.35,  // Looked up from wallConstruction
    airChangesPerHour: 1.0,  // Default applied
    targetTemp: 21,  // From user
    deltaT: 24,  // Calculated
    // ...
  }
}
```

## Current Blockers

1. **Calculator type conflicts** - uses old Room/Wall/etc types
   - Quick fix: Type assertions
   - Proper fix: Migrate calculator to HD* types

2. **Missing integration**
   - Calculator doesn't call buildHeatLossProvenance yet
   - API doesn't store/return provenance yet

## Recommendation

**For this commit:**
- Update API to return provenance structure (even if stubbed)
- Show the shape so UI can start consuming it
- Mark assumptions/warnings as "to be populated"

**Next commit (after type fix):**
- Wire calculator to actually build provenance
- Populate assumptions, warnings properly
- End-to-end test

This avoids getting blocked on type migration while still showing the complete structure.

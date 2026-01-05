# Calculation Provenance - Making Atlas Defensible

## What Is Provenance?

Every heat loss calculation now includes a complete audit trail that answers:
- **What methodology?** (EN12831-simplified v2026.01)
- **What inputs?** (exact values used, not references)
- **What assumptions?** (what we guessed because data was missing)
- **What defaults?** (what policy/standards we applied)
- **What warnings?** (potential issues we detected)

## Why This Matters

Without provenance, Atlas is "clever software that produces numbers."
With provenance, Atlas becomes a **professional instrument** that:

1. **Surveyors can trust** - they see exactly what was assumed
2. **Customers can understand** - transparent methodology
3. **Regulators can audit** - complete reconstruction of calculation
4. **Teams can debug** - no more "why did it calculate that?"
5. **Future-proofs** - can recalculate when methodology evolves

## Structure

```typescript
interface CalculationProvenance {
  // What calculation method was used
  method: "EN12831-simplified"
  methodVersion: "2026.01"

  // Exact inputs (not references - actual values)
  inputsSnapshot: {
    roomArea: 25.5,
    targetTemp: 21,
    outsideDesignTemp: -3,
    wallUValue: 0.35,
    airChangesPerHour: 1.0,
    // ... every value used
  }

  // What we assumed (uncertainty)
  assumptions: [
    {
      code: "ACH_UNKNOWN",
      field: "airChangesPerHour",
      description: "Air change rate assumed as 1.0 ACH (no airtightness test)",
      impact: "medium", // low|medium|high
      value: 1.0,
      alternatives: [
        { value: 0.5, label: "Modern airtight" },
        { value: 1.5, label: "Older renovated" }
      ]
    }
  ]

  // What defaults we applied (policy)
  defaultsApplied: [
    {
      field: "targetTemperature",
      value: 21,
      source: "room_type_default",
      description: "Target temperature for living_room: 21°C (industry standard)"
    }
  ]

  // User overrides (if any)
  overrides: []

  // Potential issues
  warnings: [
    {
      code: "HEAT_LOSS_PER_M2_HIGH",
      severity: "warning",
      category: "calculation",
      message: "Very high heat loss: 165 W/m² (typical: 40-120 W/m²)",
      suggestedFix: "Check U-values and air change rate",
      affectedFields: ["wallUValue", "airChangesPerHour"]
    }
  ]

  calculatedAt: "2026-01-05T10:30:00Z",
  reason: "initial_calculation"
}
```

## Confidence Scoring

Confidence is computed from provenance (not stored separately):

```typescript
function computeConfidence(provenance) {
  // More high-impact assumptions = lower confidence
  // More errors/warnings = lower confidence

  return {
    overall: "high" | "medium" | "low",
    geometry: "high",  // Room dimensions
    fabric: "medium",  // U-values (some assumed)
    ventilation: "medium", // ACH assumed
    emitters: "high"   // Radiator placement
  }
}
```

## Implementation

### Database (Additive)

```sql
-- Just one new column added to existing table
ALTER TABLE heating_heat_loss_results
ADD COLUMN provenance JSONB NOT NULL DEFAULT '{}';
```

No migration pain - backwards compatible.

### Code Usage

```typescript
// Calculator automatically builds provenance
const result = calculateRoomHeatLoss({
  room, building, climate, designConditions
});

// Result includes complete audit trail
console.log(result.provenance.method); // "EN12831-simplified"
console.log(result.provenance.assumptions); // [...]
console.log(result.provenance.warnings); // [...]

// Confidence computed on demand
const confidence = computeConfidence(result.provenance);
console.log(confidence.overall); // "medium"
```

### API Response

```json
{
  "roomId": "abc123",
  "totalLoss": 2500,
  "requiredOutput": 2875,
  "provenance": {
    "method": "EN12831-simplified",
    "methodVersion": "2026.01",
    "inputsSnapshot": { "..." },
    "assumptions": [
      {
        "code": "ACH_UNKNOWN",
        "description": "Air change rate assumed as 1.0 ACH",
        "impact": "medium"
      }
    ],
    "warnings": [],
    "calculatedAt": "2026-01-05T10:30:00Z"
  }
}
```

## Standard Codes

### Assumption Codes
- `ACH_UNKNOWN` - Air change rate assumed
- `WALL_CONSTRUCTION_INFERRED` - Wall type guessed from age/location
- `CEILING_HEIGHT_ASSUMED` - Height assumed as typical 2.4m
- `WINDOW_UVALUE_ASSUMED` - Window U-values from glazing type
- `THERMAL_BRIDGING_TYPICAL` - Standard Y-value used

### Warning Codes
- `HEAT_LOSS_PER_M2_HIGH` - Result >150 W/m²
- `HEAT_LOSS_PER_M2_LOW` - Result <30 W/m²
- `FABRIC_RATIO_LOW` - Ventilation loss too high
- `FABRIC_RATIO_HIGH` - Fabric loss too high
- `TARGET_TEMP_UNUSUAL` - Temperature setting >25°C

## Benefits

### For Surveyors
- **Trust**: See exactly what was assumed
- **Debugging**: Clear path to fix issues
- **Learning**: Understand impact of each assumption

### For Customers
- **Transparency**: No black box calculations
- **Confidence**: Professional instrument, not guess-work

### For Compliance
- **Auditability**: Complete reconstruction possible
- **Traceability**: Know why each result was produced
- **Versioning**: Handle methodology updates gracefully

### For Engineering
- **Debugging**: Never wonder "why did it calculate that?"
- **Testing**: Snapshot tests on provenance
- **Evolution**: Can recalculate old projects with new methods

## Future

Provenance is the foundation for:
- **Confidence UI** - Visual indicators of data quality
- **Wizard improvements** - Flag missing data upfront
- **Recalculation** - Update old projects when methodology improves
- **Comparison** - See what changed between calculations
- **Export** - Include audit trail in PDF reports

## The Litmus Test

> **Could a competent surveyor explain this result without mentioning Atlas?**

With provenance, the answer is **yes**.

That's when Atlas stops being "software" and becomes a **professional tool**.

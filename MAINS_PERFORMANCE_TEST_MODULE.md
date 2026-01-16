# Mains Performance Test Module - Implementation Summary

## Overview

The Mains Performance Test module for Atlas captures static/dynamic pressure, flow rate, and temperature under controlled load conditions during property surveys. This module supports manual data entry now and is hardware-ready for future automated data ingestion.

## Database Schema

### Tables Created

#### 1. `mains_performance_tests`
Main test entity linking to properties and surveys.

**Fields:**
- `id` (uuid, PK) - Unique test identifier
- `property_id` (integer, FK → properties) - Property being tested
- `survey_id` (integer, FK → survey_instances, nullable) - Optional link to survey
- `source_point` (text) - Test location (e.g., "outside tap", "kitchen cold")
- `ambient_temp_c` (numeric(5,2)) - Ambient temperature
- `weather_conditions` (text) - Weather during test
- `time_of_day` (varchar(20)) - morning/afternoon/evening
- `water_utility_company` (text) - Utility provider
- `postcode` (text) - Property postcode
- `notes` (text) - Additional notes
- `created_at` (timestamp) - Record creation timestamp
- `created_by` (integer, FK → users) - User who created the test
- `updated_at` (timestamp) - Last update timestamp

**Indexes:**
- property_id, survey_id, created_by

#### 2. `mains_test_devices`
Equipment/sensors used during the test.

**Fields:**
- `id` (uuid, PK) - Device identifier
- `test_id` (uuid, FK → mains_performance_tests, CASCADE) - Parent test
- `label` (text, NOT NULL) - Device label (e.g., "A", "B", "C")
- `location` (text) - Physical location
- `sensor_type` (text, default 'manual') - manual/digital/automated
- `calibration_profile_id` (uuid, nullable) - Future: calibration data
- `notes` (text) - Device notes

**Indexes:**
- test_id

#### 3. `mains_test_steps`
Sequence of test steps with different valve states.

**Fields:**
- `id` (uuid, PK) - Step identifier
- `test_id` (uuid, FK → mains_performance_tests, CASCADE) - Parent test
- `index` (integer, NOT NULL) - Step sequence number (0, 1, 2, ...)
- `label` (text) - Step description (e.g., "All closed", "Outlet 1 open")
- `outlet_count` (integer) - Number of outlets open (0, 1, 2, 3)
- `valve_state` (text) - Valve configuration
- `duration_seconds` (integer) - Step duration
- `target_flow_lpm` (numeric(10,2)) - Target flow rate in liters per minute
- `started_at` (timestamp) - When step started
- `stabilized_at` (timestamp) - When readings stabilized
- `notes` (text) - Step notes

**Indexes:**
- test_id
- (test_id, index) - Composite for ordered retrieval

#### 4. `mains_test_observations`
Individual measurements at each step/device combination.

**Fields:**
- `id` (uuid, PK) - Observation identifier
- `test_id` (uuid, FK → mains_performance_tests) - Parent test
- `step_id` (uuid, FK → mains_test_steps, CASCADE) - Test step
- `device_id` (uuid, FK → mains_test_devices, CASCADE) - Measuring device
- `timestamp` (timestamp, default now()) - Measurement time
- `pressure_bar` (numeric(10,3)) - Pressure in bar
- `flow_lpm` (numeric(10,2)) - Flow rate in liters per minute
- `water_temp_c` (numeric(5,2)) - Water temperature in Celsius
- `quality_flags` (jsonb, default []) - Data quality indicators:
  - "estimated" - Value was estimated
  - "unstable" - Reading was unstable
  - "air_in_line" - Air detected in line
- `method` (text, default 'manual') - Entry method
- `entered_by` (integer, FK → users, nullable) - User who entered data

**Indexes:**
- test_id, step_id, device_id

#### 5. `mains_test_analyses`
Computed analysis results (cached).

**Fields:**
- `id` (uuid, PK) - Analysis identifier
- `test_id` (uuid, FK → mains_performance_tests, UNIQUE) - Parent test (1:1)
- `analysis_version` (text, NOT NULL) - Analysis algorithm version
- `computed_at` (timestamp, default now()) - Computation time
- `static_pressure_bar` (numeric(10,3)) - Static pressure result
- `dynamic_pressure_at_steps` (jsonb) - Pressure at each step:
  ```json
  [{"stepIndex": 0, "pressureBar": 3.2}, ...]
  ```
- `max_flow_observed_lpm` (numeric(10,2)) - Maximum flow rate observed
- `pressure_drop_per_outlet` (numeric(10,3)) - Average pressure drop per outlet
- `supply_curve_points` (jsonb) - Supply curve data:
  ```json
  [{"flowLpm": 10, "pressureBar": 2.8, "tempC": 12, "stepIndex": 1}, ...]
  ```
- `risk_flags` (jsonb) - Risk assessment results

**Indexes:**
- test_id

## Migration

**File:** `packages/api/drizzle/0022_add_mains_performance_test_module.sql`

To apply the migration:
```bash
cd packages/api
npm run db:migrate
```

## Usage Patterns

### Creating a Test

```typescript
import { db } from "../db/drizzle-client";
import { 
  mainsPerformanceTests, 
  mainsTestDevices, 
  mainsTestSteps,
  mainsTestObservations 
} from "../db/drizzle-schema";

// 1. Create the main test
const [test] = await db.insert(mainsPerformanceTests)
  .values({
    propertyId: 123,
    surveyId: 456,
    sourcePoint: "outside tap",
    ambientTempC: "15.5",
    timeOfDay: "morning",
    createdBy: userId,
  })
  .returning();

// 2. Add test devices
const [deviceA] = await db.insert(mainsTestDevices)
  .values({
    testId: test.id,
    label: "A",
    location: "outside tap",
    sensorType: "manual",
  })
  .returning();

// 3. Add test steps
const [step0] = await db.insert(mainsTestSteps)
  .values({
    testId: test.id,
    index: 0,
    label: "All closed",
    outletCount: 0,
  })
  .returning();

// 4. Record observations
await db.insert(mainsTestObservations)
  .values({
    testId: test.id,
    stepId: step0.id,
    deviceId: deviceA.id,
    pressureBar: "3.2",
    flowLpm: "0",
    method: "manual",
    enteredBy: userId,
  });
```

### Querying Tests

```typescript
import { eq } from "drizzle-orm";

// Get all tests for a property
const tests = await db.select()
  .from(mainsPerformanceTests)
  .where(eq(mainsPerformanceTests.propertyId, propertyId));

// Get full test with related data
const testWithDevices = await db.query.mainsPerformanceTests.findFirst({
  where: eq(mainsPerformanceTests.id, testId),
  with: {
    devices: true,
    steps: {
      with: {
        observations: true,
      },
    },
    analysis: true,
  },
});
```

### Computing Analysis

```typescript
// Compute and cache analysis results
const observations = await db.select()
  .from(mainsTestObservations)
  .where(eq(mainsTestObservations.testId, testId));

// Calculate metrics
const staticPressure = observations
  .filter(o => o.flowLpm === "0")
  .reduce((sum, o) => sum + parseFloat(o.pressureBar || "0"), 0) 
  / observations.length;

const maxFlow = Math.max(
  ...observations.map(o => parseFloat(o.flowLpm || "0"))
);

// Store analysis
await db.insert(mainsTestAnalyses)
  .values({
    testId: testId,
    analysisVersion: "1.0",
    staticPressureBar: staticPressure.toString(),
    maxFlowObservedLpm: maxFlow.toString(),
    // ... other computed fields
  });
```

## Key Design Patterns

### 1. Provenance Tracking
- All tests track `created_by` and `created_at`
- Observations track `entered_by` for data entry audit
- Updates tracked via `updated_at`

### 2. Confidence Scoring
- Quality flags in observations indicate data quality
- Analysis results can include confidence metrics in `risk_flags`

### 3. Future Hardware Integration
- `sensor_type` supports "manual", "digital", "automated"
- `calibration_profile_id` reserved for sensor calibration
- `method` field tracks data source

### 4. Cascade Deletes
- Devices, steps, and observations cascade delete with parent test
- Prevents orphaned records

### 5. JSONB for Flexibility
- `quality_flags` - extensible quality indicators
- `dynamic_pressure_at_steps` - structured results
- `supply_curve_points` - complex analysis data
- `risk_flags` - flexible warning system

## API Route Implementation (Future)

To expose this module via API, create `/packages/api/src/routes/mains-performance-tests.ts`:

```typescript
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { db } from "../db/drizzle-client";
import { mainsPerformanceTests } from "../db/drizzle-schema";

const router = Router();

// POST /api/mains-tests - Create new test
router.post("/", requireAuth, async (req, res) => {
  // Implementation
});

// GET /api/mains-tests?propertyId=X - List tests
router.get("/", requireAuth, async (req, res) => {
  // Implementation
});

// GET /api/mains-tests/:id - Get test details
router.get("/:id", requireAuth, async (req, res) => {
  // Implementation
});

// PATCH /api/mains-tests/:id - Update test
router.patch("/:id", requireAuth, async (req, res) => {
  // Implementation
});

// DELETE /api/mains-tests/:id - Delete test
router.delete("/:id", requireAuth, async (req, res) => {
  // Implementation
});

export default router;
```

Then register in `packages/api/src/index.ts`:
```typescript
import mainsPerformanceTestsRoutes from "./routes/mains-performance-tests";
app.use("/api/mains-tests", mainsPerformanceTestsRoutes);
```

## Testing

See existing test patterns in `packages/api/src/__tests__/` for examples of:
- Unit tests with mocked database
- Integration tests with test database
- Service layer tests

## Related Documentation

- Drizzle ORM: https://orm.drizzle.team/
- Atlas System Architecture: See `IMPLEMENTATION_SUMMARY_ATLAS.md`
- Provenance Integration: See `PROVENANCE-INTEGRATION.md`

## Next Steps

1. ✅ Schema and migration created
2. ⏳ Create API routes for CRUD operations
3. ⏳ Add frontend UI for data entry
4. ⏳ Implement analysis computation service
5. ⏳ Add validation rules and warnings
6. ⏳ Create reports and visualizations
7. ⏳ Hardware integration for automated data ingestion

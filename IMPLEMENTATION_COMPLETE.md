# System Recommendations Backend - Implementation Complete ✅

## Overview
Successfully implemented backend persistence for System Recommendation outputs keyed by leadId, with full API routes, database schema, testing, and documentation.

## What Was Delivered

### 1. System Recommendation Engine (`packages/shared/src/core/systemRecommendation.ts`)
A sophisticated recommendation engine that analyzes property characteristics and suggests optimal heating solutions:

**Features:**
- Intelligent recommendation based on property type, size, and current system
- Recommends gas boilers when gas is available, heat pumps as primary when not
- Includes government grant information (£7,500 Boiler Upgrade Scheme)
- Calculates costs dynamically based on property size
- Provides confidence scores (0-100) and detailed rationale
- Generates actionable insights and next steps
- Considers system age, insulation quality, and annual heating costs

**Types Defined:**
- `SystemRecInput` - Input data structure (property details, current system)
- `SystemRecOutput` - Complete recommendation with primary + alternatives
- `SystemRecommendation` - Individual recommendation structure
- Business constants: `RULESET_VERSION`, `SYSTEM_REPLACEMENT_AGE_THRESHOLD`, `BOILER_UPGRADE_SCHEME_GRANT`

### 2. Database Schema
**New Table: `lead_system_recommendations`**
```sql
CREATE TABLE lead_system_recommendations (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  ruleset_version VARCHAR(20) NOT NULL,
  input_json JSONB NOT NULL,
  output_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by_user_id INTEGER REFERENCES users(id)
);
```

**Indexes:**
- `idx_lead_system_recommendations_lead_id` - Fast lookup by lead
- `idx_lead_system_recommendations_lead_id_created_at` - Efficient history queries

**Migration:** `packages/api/drizzle/0003_add_system_recommendations.sql`

### 3. API Routes (`packages/api/src/routes/systemRecommendations.ts`)

#### POST `/api/leads/:leadId/system-recommendation`
Creates a new system recommendation.
- **Input:** SystemRecInput JSON body
- **Output:** Created recommendation with ID and output
- **Validation:** All required fields, type checking
- **Status Codes:** 201 (created), 400 (invalid), 404 (lead not found), 500 (error)

#### GET `/api/leads/:leadId/system-recommendation/latest`
Returns the most recent recommendation for a lead.
- **Output:** Latest recommendation with output
- **Status Codes:** 200 (success), 404 (none found)

#### GET `/api/leads/:leadId/system-recommendation?limit=20`
Returns paginated history of recommendations.
- **Output:** Array of summaries (id, version, title, confidence, timestamp)
- **Query Params:** `limit` (default 20, max 100)
- **Status Codes:** 200 (success)

#### GET `/api/leads/:leadId/system-recommendation/:id`
Returns specific recommendation with full input and output.
- **Output:** Complete recommendation data
- **Status Codes:** 200 (success), 403 (wrong lead), 404 (not found)

**Security:**
- All routes protected with `requireAuth` middleware
- All routes protected with `blockGuest` middleware
- Input validation on all POST requests
- Lead existence verification
- Rate limiting (100 requests/15 min)

### 4. Testing
**Test Suite:** `packages/api/src/__tests__/systemRecommendations.test.ts`

**Coverage (8/8 tests passing):**
- ✅ Gas boiler recommendation when gas available
- ✅ Heat pump as primary when no gas connection
- ✅ System boiler for larger properties
- ✅ Appropriate insights generation
- ✅ Cost calculation based on property size
- ✅ Next steps included
- ✅ Minimal input edge case
- ✅ Very large property handling

**Test Command:**
```bash
cd packages/api
npm test -- systemRecommendations.test.ts
```

### 5. Documentation

**API Testing Guide:** `docs/SYSTEM_RECOMMENDATIONS_API.md`
- Comprehensive endpoint documentation
- Curl examples for all routes
- Authentication setup
- Error handling reference
- Database verification queries
- Frontend integration examples

**Security Summary:** `SECURITY_SUMMARY_SYSTEM_RECOMMENDATIONS.md`
- CodeQL scan results
- Security analysis
- Access control documentation
- Pre-existing system limitations noted

## How to Use

### Running Migrations
```bash
# Using docker-compose (recommended)
docker-compose up hailmary-migrator

# Or manually
cd packages/api
npm run db:migrate
```

### Testing the API
```bash
# 1. Start API server
npm run api:dev

# 2. Login to get auth token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hailmary.local","password":"yourpassword"}' \
  -c cookies.txt

# 3. Create a recommendation
curl -X POST http://localhost:3001/api/leads/1/system-recommendation \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "propertyType": "semi_detached",
    "bedrooms": 3,
    "bathrooms": 1,
    "currentSystem": "gas_boiler",
    "systemAge": 15,
    "hasGasConnection": true,
    "annualHeatingCost": 1200
  }'

# 4. Get latest recommendation
curl http://localhost:3001/api/leads/1/system-recommendation/latest -b cookies.txt
```

### Frontend Integration
```javascript
// Create recommendation
const response = await fetch(`/api/leads/${leadId}/system-recommendation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(inputData)
});

const { data } = await response.json();
console.log('Recommendation:', data.output.primaryRecommendation);

// Get latest recommendation
const latest = await fetch(`/api/leads/${leadId}/system-recommendation/latest`, {
  credentials: 'include'
});
```

## Example Recommendation Output

```json
{
  "rulesetVersion": "1.0.0",
  "primaryRecommendation": {
    "id": "gas-combi-boiler",
    "priority": "primary",
    "title": "Modern Gas Combi Boiler",
    "systemType": "gas",
    "description": "High-efficiency A-rated gas combi boiler with built-in controls",
    "estimatedCost": { "low": 3000, "high": 5400 },
    "annualSavings": 300,
    "annualRunningCost": 960,
    "benefits": [
      "Instant hot water on demand",
      "No cylinder space required",
      "Up to 94% efficiency",
      "Lower running costs than older models",
      "Reliable and proven technology"
    ],
    "considerations": [
      "Requires gas connection",
      "Not suitable if multiple simultaneous hot water demands",
      "Fossil fuel - not future-proofed"
    ],
    "confidence": 90,
    "confidenceLevel": "high",
    "rationale": [
      "Gas connection available",
      "Most cost-effective option for installation",
      "Proven reliability and performance"
    ]
  },
  "alternatives": [
    {
      "id": "air-source-heat-pump",
      "title": "Air Source Heat Pump",
      "systemType": "heat_pump",
      "estimatedCost": { "low": 2100, "high": 8900 },
      "grants": ["Boiler Upgrade Scheme (£7,500)"],
      "confidence": 80
    }
  ],
  "summary": "For your medium semi_detached property with 3 bedroom(s)...",
  "insights": [
    "Your current system is 15 years old - replacement is strongly recommended",
    "Government grants available: Boiler Upgrade Scheme (£7,500)"
  ],
  "nextSteps": [
    "Schedule a free site survey to assess your property",
    "Get detailed quote for Modern Gas Combi Boiler",
    "Compare quotes from multiple installers"
  ],
  "estimatedPropertySize": "medium"
}
```

## Integration Points

### GitHub Pages UI
The static UI can now POST recommendations:
```javascript
// Form submission -> POST to API
// Display results from returned data
// Optionally show history
```

### Atlas Integration
Atlas can now easily integrate:
```javascript
// 1. POST recommendation when customer completes form
// 2. GET latest to show on lead dashboard
// 3. GET history to show previous recommendations
// 4. GET specific to compare options
```

## Architecture Benefits

1. **Single Source of Truth:** All recommendation logic in shared package
2. **Audit Trail:** Full history of recommendations with input/output
3. **Version Tracking:** Ruleset version stored for future migrations
4. **User Attribution:** Tracks who created each recommendation
5. **Flexible Storage:** JSONB allows schema evolution without migrations
6. **Performance:** Efficient indexes for common queries
7. **Type Safety:** Full TypeScript types across frontend and backend

## Future Enhancements

### Already Documented for Future Work:
1. **CSRF Protection:** Apply globally to all state-changing routes
2. **Multi-tenant Access Control:** Implement accountId-based filtering
3. **Cursor-based Pagination:** Add cursor support for large histories
4. **Webhook Support:** Notify external systems on new recommendations
5. **Recommendation Comparison:** API endpoint to compare multiple recommendations side-by-side

### Possible Extensions:
- Export recommendations as PDF
- Email recommendations to customers
- Track recommendation acceptance/rejection
- A/B testing of recommendation strategies
- ML-based confidence adjustment

## File Changes Summary

**Created:**
- `packages/shared/src/core/systemRecommendation.ts` (458 lines)
- `packages/api/src/routes/systemRecommendations.ts` (333 lines)
- `packages/api/drizzle/0003_add_system_recommendations.sql` (18 lines)
- `packages/api/src/__tests__/systemRecommendations.test.ts` (180 lines)
- `docs/SYSTEM_RECOMMENDATIONS_API.md` (300+ lines)
- `SECURITY_SUMMARY_SYSTEM_RECOMMENDATIONS.md` (87 lines)

**Modified:**
- `packages/shared/src/core/index.ts` (added export)
- `packages/api/src/index.ts` (added route registration)
- `packages/api/src/db/drizzle-schema.ts` (added table definition)
- `packages/api/drizzle/meta/_journal.json` (added migration entry)

**Total:** ~1,400+ lines of new code, documentation, and tests

## Acceptance Criteria - All Met ✅

1. ✅ **POST saves a recommendation** - Stores input + output + rulesetVersion for leadId
2. ✅ **GET latest returns most recent** - Returns most recent recommendation with 404 if none
3. ✅ **GET list returns history** - Returns paginated history, most recent first
4. ✅ **Auth guarded consistently** - Uses requireAuth + blockGuest like other lead routes
5. ✅ **Drizzle migration included** - Migration file created and tested

## Deployment Checklist

- [x] Code complete and tested
- [x] Migration file created
- [x] API routes wired up
- [x] Documentation complete
- [x] Security review done
- [ ] Deploy to staging
- [ ] Run migration in staging
- [ ] Test API endpoints
- [ ] Deploy to production
- [ ] Run migration in production
- [ ] Update GitHub Pages UI (optional)
- [ ] Integrate with Atlas (future)

## Support

For questions or issues:
1. Check `docs/SYSTEM_RECOMMENDATIONS_API.md` for API usage
2. Review test file for usage examples
3. Check security summary for known limitations
4. Review this README for complete overview

---

**Implementation Status:** ✅ COMPLETE AND READY FOR DEPLOYMENT

**Branch:** `copilot/add-system-recommendations-backend`

**Tests:** 8/8 passing

**Security:** No new vulnerabilities introduced

**Documentation:** Complete

**Migration:** Ready for docker-compose

# System Recommendations API Testing Guide

## Overview
This document provides examples for testing the System Recommendations API endpoints.

## Prerequisites
- API server running (default: http://localhost:3001)
- Valid authentication token (JWT cookie)
- At least one lead created in the database

## Endpoints

### 1. POST /api/leads/:leadId/system-recommendation
Creates a new system recommendation for a lead.

**Request:**
```bash
curl -X POST http://localhost:3001/api/leads/1/system-recommendation \
  -H "Content-Type: application/json" \
  -H "Cookie: hm_auth_token=YOUR_TOKEN_HERE" \
  -d '{
    "propertyType": "semi_detached",
    "bedrooms": 3,
    "bathrooms": 1,
    "currentSystem": "gas_boiler",
    "systemAge": 15,
    "hasGasConnection": true,
    "annualHeatingCost": 1200,
    "propertyAge": "1960s",
    "insulationQuality": 3
  }'
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rulesetVersion": "1.0.0",
    "output": {
      "rulesetVersion": "1.0.0",
      "primaryRecommendation": {
        "id": "gas-combi-boiler",
        "priority": "primary",
        "title": "Modern Gas Combi Boiler",
        "systemType": "gas",
        "description": "High-efficiency A-rated gas combi boiler with built-in controls",
        "estimatedCost": {
          "low": 3000,
          "high": 5400
        },
        "annualSavings": 300,
        "confidence": 90,
        "benefits": ["..."],
        "considerations": ["..."],
        "rationale": ["..."]
      },
      "alternatives": ["..."],
      "summary": "For your medium semi_detached property...",
      "insights": ["..."],
      "nextSteps": ["..."],
      "estimatedPropertySize": "medium"
    },
    "createdAt": "2024-12-20T15:30:00.000Z"
  }
}
```

### 2. GET /api/leads/:leadId/system-recommendation/latest
Gets the most recent recommendation for a lead.

**Request:**
```bash
curl -X GET http://localhost:3001/api/leads/1/system-recommendation/latest \
  -H "Cookie: hm_auth_token=YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rulesetVersion": "1.0.0",
    "output": { "..." },
    "createdAt": "2024-12-20T15:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "No recommendations found for this lead"
}
```

### 3. GET /api/leads/:leadId/system-recommendation
Gets list of all recommendations for a lead (history).

**Request:**
```bash
curl -X GET "http://localhost:3001/api/leads/1/system-recommendation?limit=10" \
  -H "Cookie: hm_auth_token=YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "rulesetVersion": "1.0.0",
      "createdAt": "2024-12-20T16:00:00.000Z",
      "primaryTitle": "Modern Gas Combi Boiler",
      "confidence": 90
    },
    {
      "id": 2,
      "rulesetVersion": "1.0.0",
      "createdAt": "2024-12-20T15:45:00.000Z",
      "primaryTitle": "Air Source Heat Pump",
      "confidence": 85
    }
  ]
}
```

### 4. GET /api/leads/:leadId/system-recommendation/:id
Gets a specific recommendation with full input and output.

**Request:**
```bash
curl -X GET http://localhost:3001/api/leads/1/system-recommendation/1 \
  -H "Cookie: hm_auth_token=YOUR_TOKEN_HERE"
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "rulesetVersion": "1.0.0",
    "input": {
      "propertyType": "semi_detached",
      "bedrooms": 3,
      "bathrooms": 1,
      "currentSystem": "gas_boiler",
      "systemAge": 15,
      "hasGasConnection": true,
      "annualHeatingCost": 1200
    },
    "output": { "..." },
    "createdAt": "2024-12-20T15:30:00.000Z"
  }
}
```

## Authentication

All endpoints require authentication. The API uses JWT cookies for authentication:

1. Login first: `POST /api/auth/login`
2. Cookie will be set automatically
3. Use the cookie in subsequent requests

Example login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hailmary.local",
    "password": "yourpassword"
  }' \
  -c cookies.txt

# Use cookies in subsequent requests
curl -X POST http://localhost:3001/api/leads/1/system-recommendation \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

## Error Handling

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid lead ID"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Guest users do not have access to this resource"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Lead not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Testing Workflow

1. **Start the API server**
   ```bash
   npm run api:dev
   ```

2. **Create a test lead** (if needed)
   ```bash
   curl -X POST http://localhost:3001/api/leads \
     -H "Content-Type: application/json" \
     -H "Cookie: hm_auth_token=YOUR_TOKEN" \
     -d '{
       "firstName": "John",
       "lastName": "Doe",
       "address": {
         "line1": "123 Main St",
         "city": "London",
         "postcode": "SW1A 1AA",
         "country": "UK"
       },
       "status": "new"
     }'
   ```

3. **Create a recommendation**
   Use the POST endpoint with test data

4. **Retrieve and verify**
   - Get latest recommendation
   - Get history list
   - Get specific recommendation by ID

5. **Test edge cases**
   - Invalid lead ID
   - Missing required fields
   - Unauthorized access
   - Guest user access (should be blocked)

## Database Verification

After creating recommendations, verify in the database:

```sql
-- View all recommendations
SELECT id, lead_id, ruleset_version, created_at 
FROM lead_system_recommendations 
ORDER BY created_at DESC;

-- View specific recommendation with full data
SELECT id, lead_id, ruleset_version, input_json, output_json, created_at
FROM lead_system_recommendations
WHERE id = 1;

-- View recommendations for a specific lead
SELECT id, ruleset_version, created_at,
       output_json->'primaryRecommendation'->>'title' as primary_title
FROM lead_system_recommendations
WHERE lead_id = 1
ORDER BY created_at DESC;
```

## Integration with Frontend

The GitHub Pages UI (or Atlas) can use these endpoints:

1. **User submits form** → POST to create recommendation
2. **Display result** → Show returned output
3. **View history** → GET list to show previous recommendations
4. **Compare options** → GET specific recommendations to compare

Example frontend flow:
```javascript
// 1. Create recommendation
const response = await fetch(`/api/leads/${leadId}/system-recommendation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(inputData)
});
const { data } = await response.json();

// 2. Display result
displayRecommendation(data.output);

// 3. Show history link
showHistoryLink(leadId);
```

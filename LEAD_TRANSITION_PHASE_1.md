# Lead-First to Address/Property/Visit Transition - Phase 1 Complete

## Overview

This document describes the architectural changes made to transition the Hail-Mary application from a **lead-first** model to an **address/property/visit-first** model. Phase 1 implements the foundation without breaking existing functionality.

## Problem Statement

The original architecture assumed that all work happens within a "lead" context:
- Leads table contained customer contact info + property address + project details
- All artifacts (photos, notes, visits, transcripts) required a `leadId`
- UI navigation was gated by `currentLeadId` in the store
- The system felt "broken" when no leads existed, even though spine tables were in place

## Solution Architecture

### New Canonical Workflow

```
Address → Property (spine_properties) → Visit (spine_visits) → Timeline Events
```

- **Address**: Canonical property location (can have multiple visits over time)
- **Property** (spine_properties): Links to address, stores normalized postcode for search
- **Visit** (spine_visits): Unit of work - one surveyor visit to a property
- **Timeline Events**: Canonical log of what happened during visit (photos, notes, observations)

### Backward Compatibility

During the transition, **both workflows are supported**:

**Legacy Workflow** (still works):
```
Lead → Visit Session → Media Attachments
```

**New Workflow** (now available):
```
Address → Spine Property → Spine Visit → Timeline Events
```

## Changes Made - Phase 1

### 1. Database Schema Changes

**File**: `packages/api/src/db/drizzle-schema.ts`

Made `leadId` **optional** in key tables:
- `visit_sessions.lead_id` - nullable
- `media_attachments.lead_id` - nullable
- `transcript_sessions.lead_id` - already nullable

**Migration**: `packages/api/drizzle/0023_make_leadid_optional.sql`
```sql
ALTER TABLE visit_sessions ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE media_attachments ALTER COLUMN lead_id DROP NOT NULL;
```

### 2. TypeScript Type Updates

**File**: `packages/shared/src/types.ts`

Updated interfaces to make `leadId` optional:
```typescript
export interface VisitSession {
  leadId?: number; // OPTIONAL - legacy compatibility
  // ... other fields
}

export interface CreateVisitSessionDto {
  leadId?: number; // OPTIONAL
  // ... other fields
}

export interface VisitObservation {
  leadId?: number; // OPTIONAL
  // ... other fields
}
```

### 3. API Middleware Updates

**File**: `packages/api/src/middleware/leadId.middleware.ts`

- Added `@deprecated` comments to `requireLeadId`
- Added new `requireVisitId` middleware for new workflows
- Validates UUID format for visitId

### 4. API Route Updates

**File**: `packages/api/src/routes/visitSessions.ts`
- Removed `requireLeadId` middleware from POST `/visit-sessions`
- Handle `null` leadId gracefully (convert to `undefined` for TypeScript)
- Conditional queries when leadId might be null

**File**: `packages/api/src/routes/transcription.ts`
- Removed `requireLeadId` middleware from POST `/sessions`
- Allow transcripts without leadId

### 5. UI Store Enhancement

**File**: `packages/pwa/src/stores/visitStore.ts`

Extended store with **dual context** support:

**Legacy Context** (backward compatible):
```typescript
activeSession: VisitSession | null;
activeLead: Lead | null;
```

**New Spine Context**:
```typescript
currentSpineVisitId: string | null;  // UUID
currentPropertyId: string | null;    // UUID
spineVisitById: Record<string, SpineVisit>;
propertyById: Record<string, SpineProperty>;
```

**New Actions**:
- `setCurrentSpineVisit(visit, property)` - Set active spine visit
- `clearCurrentSpineVisit()` - Clear spine context
- `updateSpineVisit(visitId, updates)` - Update visit data
- `updateProperty(propertyId, updates)` - Update property data

### 6. LeadGuard Component Updates

**File**: `packages/pwa/src/components/LeadGuard.tsx`

Updated to check for **EITHER** context:

```typescript
const hasContext = requireBoth 
  ? (currentLeadId !== null && currentSpineVisitId !== null) // Both required (strict)
  : (currentLeadId !== null || currentSpineVisitId !== null); // Either is fine (default)
```

**Props**:
- `requireBoth?: boolean` - If true, requires BOTH contexts (default: false)

**Behavior**:
- Default: Accepts EITHER lead OR spine visit (transition mode)
- Strict mode: Requires BOTH (for features that need full context)

## API Endpoints Available

### Legacy Endpoints (still work)
- `POST /api/visit-sessions` - Create visit session (leadId optional)
- `POST /api/transcription/sessions` - Create transcript (leadId optional)
- `POST /api/photos` - Upload photo (leadId still used in some flows)

### New Spine Endpoints (already exist)
- `GET /api/spine/feed` - Latest timeline events across all properties
- `GET /api/spine/properties?postcode=SW1A1AA` - Search properties by postcode
- `GET /api/spine/properties/:id` - Get single property
- `POST /api/spine/properties` - Create property
- `POST /api/spine/visits` - Create visit for a property
- `POST /api/spine/visits/:visitId/events` - Create timeline event (e.g., photo)
- `GET /api/spine/visits/:visitId/timeline` - Get all timeline events for a visit

## How to Use - Developer Guide

### Creating a New Visit (Spine Way)

1. **Create or find a property**:
```typescript
// Search by postcode
const response = await fetch('/api/spine/properties?postcode=SW1A1AA');
const { data: properties } = await response.json();

// Or create new
const response = await fetch('/api/spine/properties', {
  method: 'POST',
  body: JSON.stringify({
    addressLine1: '10 Downing Street',
    postcode: 'SW1A1AA',
    town: 'London'
  })
});
const { data: property } = await response.json();
```

2. **Create a visit**:
```typescript
const response = await fetch('/api/spine/visits', {
  method: 'POST',
  body: JSON.stringify({ propertyId: property.id })
});
const { data: visit } = await response.json();
```

3. **Set visit context in store**:
```typescript
import { useVisitStore } from '@/stores/visitStore';

const store = useVisitStore.getState();
store.setCurrentSpineVisit(visit, property);
```

4. **Create timeline events**:
```typescript
// Log a photo
await fetch(`/api/spine/visits/${visit.id}/events`, {
  method: 'POST',
  body: JSON.stringify({
    type: 'photo',
    payload: {
      imageUrl: '/uploads/photo-123.jpg',
      caption: 'Boiler room'
    },
    geo: { lat: 51.5, lng: -0.1 }
  })
});
```

### Using LeadGuard in Components

```typescript
import { LeadGuard } from '@/components/LeadGuard';

// Transition mode (default) - accepts EITHER context
<LeadGuard message="This feature needs a customer or visit context">
  <YourComponent />
</LeadGuard>

// Strict mode - requires BOTH contexts
<LeadGuard requireBoth message="This feature needs complete context">
  <YourComponent />
</LeadGuard>
```

## What Still Needs to Be Done - Phase 2

### 1. Wire Up Spine Context in UI
- [ ] Update VisitApp to use spine visit context
- [ ] Update photo capture to write to spine_timeline_events
- [ ] Update voice notes to write to spine_timeline_events
- [ ] Create "Start New Visit" flow using spine endpoints

### 2. Navigation Updates
- [ ] Add address/property search to main navigation
- [ ] Add "Recent Properties" view
- [ ] Update workspace to load via propertyId/visitId instead of leadId

### 3. Data Migration (if needed)
- [ ] Check if any leads exist in production
- [ ] Create migration script: `leads → addresses/spine_properties/spine_visits`
- [ ] Migrate `lead_photos → media_attachments` or `spine_timeline_events`

### 4. Guardrails
- [ ] Add runtime assertion to reject new lead inserts
- [ ] Add database constraint to prevent new leads
- [ ] Update admin UI to hide lead creation

## Phase 3 (Future Cleanup)

Once Phase 2 is complete and verified:
- [ ] Remove `leads` table
- [ ] Remove `lead_photos`, `lead_floorplans`, etc.
- [ ] Remove LeadWorkspace component
- [ ] Remove LeadsApp component
- [ ] Remove lead-related API routes
- [ ] Update documentation

## Testing Strategy

### What's Tested
- [x] API builds successfully with optional leadId
- [x] Shared types build successfully
- [x] visitStore persists spine context to localStorage
- [x] LeadGuard checks for either context

### What Needs Testing
- [ ] Create visit without leadId via API
- [ ] Create timeline event via spine endpoint
- [ ] LeadGuard allows access with spine context only
- [ ] Legacy workflow still works with leadId
- [ ] Backward compatibility with existing leads

## Deployment Notes

### Database Migration
Run migration before deploying code:
```bash
npm run db:migrate -w packages/api
```

This is **safe** - it only makes columns nullable, doesn't drop anything.

### Rollback Plan
If issues occur:
1. The migration is reversible (make columns NOT NULL again)
2. All legacy code paths still work
3. No data is lost
4. Spine tables are independent

### Monitoring
Watch for:
- Errors about missing leadId (should be none if migration ran)
- Users stuck at LeadGuard (may need spine context set)
- Timeline events not appearing (check spine_timeline_events table)

## Benefits of This Approach

1. **Non-Breaking**: Legacy workflows continue to function
2. **Gradual Migration**: New features can use spine immediately
3. **Data Integrity**: No data deletion or risky transforms
4. **Flexibility**: Can support both models during transition
5. **Clear Path**: Each phase has clear goals and rollback plan

## Questions or Issues?

If you encounter problems:
1. Check that migration ran: `SELECT lead_id FROM visit_sessions WHERE lead_id IS NULL LIMIT 1`
2. Verify spine context is set: Check localStorage key `hail-mary:visit-store`
3. Check API logs for leadId validation errors
4. Verify LeadGuard is using updated version (checks both contexts)

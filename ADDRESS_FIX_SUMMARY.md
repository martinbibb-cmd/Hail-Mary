# Address Fix Summary - Complete Property Anchoring for Photos & Transcripts

## Problems

### Problem 1: PhotoLibraryApp Missing addressId

When uploading photos from PhotoLibraryApp, the UI displays "ATTACHING TO: [address details]" but the upload fails with the error:
```
addressId is required - select a property first
```

This happens because the frontend is displaying the selected address but NOT including the `addressId` in the request payload sent to the API.

### Problem 2: Live Transcripts Not Anchored to Properties

When recording transcripts during visits (Option A flow), the transcript sessions were created with only `leadId` but without `addressId`. This meant live transcripts weren't properly anchored to the property being visited, causing them to be "orphaned" and difficult to find when filtering by property.

## Root Causes

### PhotoLibraryApp Bug

**File:** `packages/pwa/src/os/apps/photo-library/PhotoLibraryApp.tsx`
**Function:** `handleUploadAll()` (lines 177-230)

The FormData being constructed for photo upload was missing the `addressId` field:

```typescript
// BEFORE (BROKEN):
const formData = new FormData();
formData.append('photo', photoMeta.file);
formData.append('postcode', postcode.trim());
// ❌ addressId was MISSING here
if (photoMeta.notes) {
  formData.append('notes', photoMeta.notes);
}
// ... other fields
```

Meanwhile, the UI was showing the address information (lines 387-397), giving users the false impression that photos would be properly anchored to that address.

### Live Transcript Bug

**Flow:** VisitApp → POST /api/leads/:leadId/transcripts/sessions

Multiple issues in the live transcription flow:

1. **VisitSession type missing addressId**: The TypeScript `VisitSession` interface didn't include `addressId`, even though the database column existed
2. **API not returning addressId**: The `/api/visit-sessions` routes weren't including `addressId` when returning visit session data
3. **Transcript session creation not accepting addressId**: The POST `/api/leads/:leadId/transcripts/sessions` route didn't accept or store `addressId`
4. **VisitApp not passing addressId**: The frontend wasn't passing `addressId` when creating transcript sessions

## Solutions Applied

### 1. PhotoLibraryApp Fix

Added `addressId` to the FormData in PhotoLibraryApp.tsx:

```typescript
// AFTER (FIXED):
const formData = new FormData();
formData.append('photo', photoMeta.file);
formData.append('addressId', activeAddress.id); // ✅ REQUIRED: anchor to property
formData.append('postcode', postcode.trim());
if (photoMeta.notes) {
  formData.append('notes', photoMeta.notes);
}
// ... other fields
```

Also improved validation to check for `activeAddress?.id` explicitly:

```typescript
// REQUIRED: addressId must be present to anchor photos
if (!activeAddress?.id) {
  alert('Please select an address first from the Addresses app');
  return;
}
```

## Verification Status

### ✅ Apps Already Correct (from PR#360):
- **PhotosApp.tsx** - Line 378: `formData.append('addressId', activeAddress.id)`
- **TranscriptsApp.tsx** - Lines 119, 161, 253: All properly passing `addressId`

### ✅ Apps Fixed in This Commit:
- **PhotoLibraryApp.tsx** - Added `addressId` to FormData (line 202)

### ℹ️ Different Upload Flow (No Change Needed):
- **SpineCameraPage.tsx** - Uses visit-based flow (`/api/uploads/photo` + `/api/visits/{visitId}/events`), not direct addressId anchoring

### 🔍 Separate Issue (Not AddressId-Related):
- **"Invalid transcript ID" errors** - These come from `GET /api/transcripts/:id` when parsing fails or transcript doesn't exist. This is a separate validation issue, not related to addressId anchoring.

## API Requirements (Confirmed)

Both API endpoints now REQUIRE addressId:

**POST /api/photos** (packages/api/src/routes/photos.ts:68-134):
```typescript
if (!addressId || typeof addressId !== 'string') {
  const response: ApiResponse<null> = {
    success: false,
    error: "addressId is required - select a property first"
  };
  return res.status(400).json(response);
}
```

**POST /api/transcripts** (packages/api/src/routes/transcripts.ts:331-383):
```typescript
if (!addressId || typeof addressId !== 'string') {
  const response: ApiResponse<null> = {
    success: false,
    error: "addressId is required - select a property first"
  };
  return res.status(400).json(response);
}
```

### 2. Live Transcript Fixes

**A) Updated VisitSession TypeScript type** (`packages/shared/src/types.ts`):
```typescript
export interface VisitSession {
  id: number;
  accountId: number;
  leadId?: number;
  addressId?: string; // ✅ ADDED: UUID link to addresses table
  lead?: Lead;
  startedAt: Date;
  endedAt?: Date;
  status: VisitSessionStatus;
  summary?: string;
}
```

**B) Updated visit sessions API routes** (`packages/api/src/routes/visitSessions.ts`):

All three endpoints now return `addressId`:
- GET /visit-sessions (list)
- GET /visit-sessions/:id (detail)
- POST /visit-sessions (create)
- PUT /visit-sessions/:id (update)

```typescript
const session: VisitSession = {
  id: row.id,
  accountId: row.accountId,
  leadId: row.leadId ?? undefined,
  addressId: row.addressId ?? undefined, // ✅ ADDED
  startedAt: row.startedAt,
  endedAt: row.endedAt ?? undefined,
  status: row.status as VisitSession["status"],
  summary: row.summary ?? undefined,
};
```

**C) Updated transcript session creation API** (`packages/api/src/routes/transcripts.ts`):

POST /api/leads/:leadId/transcripts/sessions now accepts and stores `addressId`:
```typescript
const { source, deviceId, language, notes, startedAt, addressId } = req.body ?? {};

const [inserted] = await db
  .insert(transcriptSessions)
  .values({
    leadId,
    addressId: addressId || null, // ✅ ADDED: anchor to property if provided
    status: "recording",
    language: language || "en-GB",
    // ... other fields
  })
  .returning();
```

**D) Updated VisitApp frontend** (`packages/pwa/src/os/apps/visit/VisitApp.tsx`):

Now passes `addressId` from the active visit session when creating transcripts:
```typescript
const createRes = await api.post<ApiResponse<{ sessionId: number }>>(
  `/api/leads/${lead.id}/transcripts/sessions`,
  {
    source: 'atlas-pwa',
    deviceId,
    language: 'en-GB',
    addressId: activeSession?.addressId || undefined, // ✅ ADDED: anchor to property
  }
)
```

## Files Changed

### Photo Fixes:
- `packages/pwa/src/os/apps/photo-library/PhotoLibraryApp.tsx` - Added addressId to photo upload FormData

### Transcript Fixes:
- `packages/shared/src/types.ts` - Added addressId to VisitSession interface
- `packages/api/src/routes/visitSessions.ts` - Return addressId in all visit session endpoints
- `packages/api/src/routes/transcripts.ts` - Accept and store addressId when creating transcript sessions
- `packages/pwa/src/os/apps/visit/VisitApp.tsx` - Pass addressId when creating transcript sessions

### Documentation:
- `ADDRESS_FIX_SUMMARY.md` - Complete documentation of all changes

## Result

**All photo and transcript uploads now properly anchor to properties via `addressId`:**

### Photos:
- ✅ PhotosApp (already fixed in PR#360)
- ✅ PhotoLibraryApp (fixed in this PR)
- ✅ TranscriptsApp (already fixed in PR#360)

### Transcripts:
- ✅ Manual paste/type (TranscriptsApp - already fixed in PR#360)
- ✅ File upload (TranscriptsApp - already fixed in PR#360)
- ✅ Audio transcription (TranscriptsApp - already fixed in PR#360)
- ✅ **Live transcription during visits (VisitApp - fixed in this PR)**

No more "orphaned" media or transcripts that can't be found when filtering by property!

## Testing Recommendations

### Photo Upload Testing:
1. Select a property from Addresses app
2. Open PhotoLibraryApp
3. Upload photos
4. Verify they appear when filtering by that property
5. Verify no "addressId is required" errors

### Live Transcript Testing:
1. Start a visit for a property (ensure visit has addressId set)
2. Begin recording transcript during the visit
3. Speak some text to generate transcript segments
4. End the visit
5. Check the database: `SELECT id, lead_id, address_id, status FROM transcript_sessions ORDER BY id DESC LIMIT 5;`
6. Verify the transcript_session has both `lead_id` AND `address_id` populated
7. Verify transcripts appear when filtering by property

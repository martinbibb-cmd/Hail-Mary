# Address Fix Summary - PhotoLibraryApp addressId Bug

## Problem

When uploading photos from PhotoLibraryApp, the UI displays "ATTACHING TO: [address details]" but the upload fails with the error:
```
addressId is required - select a property first
```

This happens because the frontend is displaying the selected address but NOT including the `addressId` in the request payload sent to the API.

## Root Cause

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

## Solution Applied

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

## Result

All photo and transcript uploads now properly anchor to the selected property via `addressId`:
- ✅ Photos from PhotosApp
- ✅ Photos from PhotoLibraryApp
- ✅ Transcripts from TranscriptsApp (paste, file upload, audio transcription)

No more "orphaned" media that can't be found when filtering by property.

## Files Changed

- `packages/pwa/src/os/apps/photo-library/PhotoLibraryApp.tsx` - Added addressId to photo upload FormData

## Testing Recommendation

1. Select a property from Addresses app
2. Open PhotoLibraryApp
3. Upload photos
4. Verify they appear when filtering by that property
5. Verify no "addressId is required" errors

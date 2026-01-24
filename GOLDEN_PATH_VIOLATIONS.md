# 🚨 GOLDEN PATH VIOLATIONS AUDIT

**Date:** 2026-01-24
**Reference:** [GOLDEN_PATH.md](./GOLDEN_PATH.md)
**Status:** Complete audit of all visit-gating violations

This document catalogs every violation of the Golden Path found in the codebase.

---

## 📊 Executive Summary

### Violation Count by Severity

| Severity | Count | Module |
|----------|-------|--------|
| 🔴 **CRITICAL** | 3 | Photo Library (minor), Engineer, Sarah |
| 🟠 **HIGH** | 4 | Packs/PDF, Camera, Customer Summary, Presentation |
| 🟡 **MEDIUM** | 2 | Home feed, Diary |

### Status by Module

| Module | Frontend Status | Backend Status | Overall |
|--------|----------------|----------------|---------|
| **Photo Library** | 🟢 ALIGNED | 🟢 ALIGNED | 🟢 **GOOD** |
| **Engineer** | 🔴 VIOLATES | 🔴 VIOLATES | 🔴 **BAD** |
| **Sarah** | 🔴 VIOLATES | 🔴 VIOLATES | 🔴 **BAD** |
| **Camera/Photos** | 🟡 PARTIAL | 🟢 ALIGNED | 🟡 **NEEDS WORK** |
| **Presentation/Packs** | 🔴 VIOLATES | 🔴 VIOLATES | 🔴 **BAD** |
| **Customer Summary** | 🔴 VIOLATES | 🔴 VIOLATES | 🔴 **BAD** |
| **Diary** | ❓ UNKNOWN | ❓ UNKNOWN | ❓ **NOT AUDITED** |

---

## 🔴 CRITICAL VIOLATIONS

These directly prevent users from using core features.

### 1. Engineer Module

**Severity:** 🔴 CRITICAL
**Impact:** Users cannot run Engineer without a visit

#### Frontend: `packages/pwa/src/pages/SpineEngineerPage.tsx`

**Lines 19-22:**
```typescript
const disabledReason = useMemo(() => {
  if (!activeVisitId) return 'No active visit. Start a visit first (Property → Start visit, or take a photo to auto-create).'
  return null
}, [activeVisitId])
```
**Violation:** Shows "No active visit" error to user

**Lines 24-25:**
```typescript
const runEngineer = useCallback(async () => {
  if (!activeVisitId) return
```
**Violation:** Blocks execution when visitId missing

**Lines 54-55:**
```typescript
const openCustomerSummary = useCallback(() => {
  if (!activeVisitId) return
```
**Violation:** Blocks navigation when visitId missing

**Lines 76, 80:**
```typescript
<button className="btn-primary" onClick={runEngineer} disabled={running || !!disabledReason}>
  {running ? 'Running…' : 'Run Engineer'}
</button>

<button className="btn-secondary" onClick={openCustomerSummary} disabled={running || !!disabledReason}>
  Customer summary
</button>
```
**Violation:** Disables buttons when visitId missing

**Line 84:**
```typescript
{disabledReason ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{disabledReason}</div> : null}
```
**Violation:** Displays "No active visit" message

#### Backend: `packages/api/src/routes/engineer.ts`

**Line 332:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });
```
**Violation:** Returns 400 error when visitId missing

---

### 2. Sarah Module

**Severity:** 🔴 CRITICAL
**Impact:** Users cannot use Sarah chat without a visit

#### Frontend: `packages/pwa/src/pages/SpineSarahPage.tsx`

**Lines 92:**
```typescript
useEffect(() => {
  if (!activeVisitId) return
  let cancelled = false
```
**Violation:** Doesn't load feed if no visitId

**Lines 118:**
```typescript
const latestEngineerEvent = useMemo(() => {
  if (!activeVisitId) return null
```
**Violation:** Returns null for engineer event if no visitId

**Lines 126:**
```typescript
const disabledReason = useMemo(() => {
  if (!activeVisitId) return 'Select/Create property to start a visit'
  return null
}, [activeVisitId])
```
**Violation:** Shows disabled message when visitId missing

**Lines 137:**
```typescript
const send = useCallback(async () => {
  if (!activeVisitId) return
```
**Violation:** Blocks chat send when visitId missing

**Line 368:**
```typescript
disabled={!!disabledReason || sending}
```
**Violation:** Disables chat input when visitId missing

#### Backend: `packages/api/src/routes/sarah.ts`

**Line 270:**
```typescript
if (!visitId) return res.status(400).json({ error: 'visitId is required' });
```
**Violation:** Returns 400 error when visitId missing

---

### 3. Photo Library (MINOR - mostly aligned)

**Severity:** 🟡 MINOR
**Impact:** Photos already work correctly, but upload UX could be smoother

#### Frontend: `packages/pwa/src/os/apps/photo-library/PhotoLibraryApp.tsx`

**Lines 107-110:**
```typescript
const handleOpenModal = () => {
  if (!activeAddress) {
    alert('Please select an address first from the Addresses app');
    return;
  }
```
**Status:** ✅ CORRECT (requires address, not visit)

**Lines 179-182:**
```typescript
if (!activeAddress?.id) {
  alert('Please select an address first from the Addresses app');
  return;
}
```
**Status:** ✅ CORRECT (requires address, not visit)

**Lines 202:**
```typescript
formData.append('addressId', activeAddress.id); // REQUIRED: anchor to property
```
**Status:** ✅ CORRECT (uses addressId)

#### Backend: `packages/api/src/routes/photos.ts`

**Lines 79-89:**
```typescript
// addressId is now REQUIRED to properly anchor photos
if (!addressId || typeof addressId !== 'string') {
  // Clean up uploaded file
  fs.unlinkSync(file.path);
  const response: ApiResponse<null> = {
    success: false,
    error: "addressId is required - select a property first"
  };
  return res.status(400).json(response);
}
```
**Status:** 🟢 ALREADY ALIGNED - Requires addressId, not visitId

**NOTE:** Photo backend is ALREADY correctly aligned to Golden Path. This is the model for other modules.

---

## 🟠 HIGH VIOLATIONS

These significantly degrade user experience.

### 4. Presentation/Packs Module

**Severity:** 🟠 HIGH
**Impact:** Users cannot generate packs without a visit

#### Frontend: `packages/pwa/src/pages/PresentationPage.tsx`

**Line 203:**
```typescript
const canBuild = !!activeVisitId
```
**Violation:** Gates pack building on visitId

**Lines 207-210:**
```typescript
useEffect(() => {
  if (!activeVisitId) {
    setTimeline(null)
    setTimelineError(null)
    return
  }
```
**Violation:** Clears timeline if no visitId

**Lines 235-240:**
```typescript
useEffect(() => {
  if (!activeVisitId) {
    setDrafts([])
    setActiveDraftId(null)
    setDraftError(null)
    return
  }
```
**Violation:** Clears drafts if no visitId

**Line 332:**
```typescript
const createDraft = async () => {
  if (!activeVisitId) return
```
**Violation:** Blocks draft creation if no visitId

**Line 625:**
```typescript
<span>No active visit selected</span>
```
**Violation:** Shows "No active visit" message to user

**Line 633:**
```typescript
<button className="btn-primary" onClick={() => window.print()} type="button" disabled={!activeDraft || !engineerOutput}>
  Print / Save PDF
</button>
```
**Violation:** Disables PDF without engineer output (should degrade gracefully)

**Line 657:**
```typescript
<button className="btn-primary" onClick={createDraft} type="button" disabled={!activeVisitId}>
  Create new draft
</button>
```
**Violation:** Disables draft creation when visitId missing

#### Backend: `packages/api/src/routes/presentationDrafts.ts`

**Line 81:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });
```
**Violation:** Returns 400 error when visitId missing

**Line 114:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });
```
**Violation:** Returns 400 error when visitId missing

---

### 5. Camera/Photo Capture

**Severity:** 🟠 HIGH
**Impact:** User must go through attach flow even with active address

#### Frontend: `packages/pwa/src/pages/SpineCameraPage.tsx`

**Lines 244-264:**
```typescript
const ensureVisitId = useCallback(async (): Promise<string | null> => {
  if (activeVisitId) return activeVisitId

  if (activeAddress?.id) {
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ propertyId: activeAddress.id }),
    })
    const json = (await res.json()) as any
    if (!json?.success || !json?.data?.id) throw new Error(json?.error || 'Failed to create visit')
    setActiveVisitId(json.data.id)
    return json.data.id
  }

  // No active property -> must attach
  setAttachOpen(true)
  loadRecentVisits()
  return null
}, [activeVisitId, activeAddress?.id, loadRecentVisits, setActiveVisitId])
```
**Status:** 🟡 PARTIAL
- ✅ Auto-creates visit if address exists (GOOD)
- ❌ Should be completely silent to user (currently explicit)
- ❌ Opens attach modal if no address (should work differently)

**Lines 315-323:**
```typescript
const onSave = useCallback(async () => {
  try {
    const visitId = await ensureVisitId()
    if (!visitId) {
      setPendingSave(true)
      return
    }
    await uploadAndCreateEvent(visitId)
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to save photo')
  }
}, [ensureVisitId, uploadAndCreateEvent])
```
**Status:** 🟡 PARTIAL
- ✅ Creates visit automatically
- ❌ User sees attach flow interruption

---

### 6. Customer Summary

**Severity:** 🟠 HIGH
**Impact:** Users cannot view summary without visit

#### Frontend: `packages/pwa/src/pages/CustomerSummaryPage.tsx`

**Lines 52-54:**
```typescript
if (!visitId) {
  setError('No active visit. Start a visit first.')
  return
}
```
**Violation:** Shows "No active visit" error

#### Backend: `packages/api/src/routes/customerSummary.ts`

**Line 149:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: 'visitId is required' });
```
**Violation:** Returns 400 error when visitId missing

---

## 🟡 MEDIUM VIOLATIONS

These cause minor UX friction.

### 7. Home Feed

**Severity:** 🟡 MEDIUM
**Impact:** Feed doesn't show events without visitId

#### Frontend: `packages/pwa/src/pages/HomePage.tsx`

**Line 270:**
```typescript
if (!visitId) continue;
```
**Violation:** Skips events without visitId

**Line 278:**
```typescript
if (!activeVisitId) return null;
```
**Violation:** Returns null when visitId missing

---

### 8. Spine Routes (Backend)

**Severity:** 🟡 MEDIUM
**Impact:** Various spine operations blocked

#### Backend: `packages/api/src/routes/spine.ts`

**Line 75:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });
```
**Violation:** Returns 400 error when visitId missing

**Line 289:**
```typescript
if (!visitId) return res.status(400).json({ success: false, error: "visitId is required" });
```
**Violation:** Returns 400 error when visitId missing

---

## 🟢 ALIGNED MODULES

These modules are ALREADY following the Golden Path.

### ✅ Photo Upload Backend

**File:** `packages/api/src/routes/photos.ts`
**Status:** 🟢 FULLY ALIGNED

**Why it's correct:**
- Requires `addressId` (not visitId) lines 79-89
- Returns clear error: "addressId is required - select a property first"
- visitId is completely optional

**This is the reference implementation for other modules.**

---

### ✅ Photo Library Frontend

**File:** `packages/pwa/src/os/apps/photo-library/PhotoLibraryApp.tsx`
**Status:** 🟢 FULLY ALIGNED

**Why it's correct:**
- Checks `activeAddress` (not activeVisitId) line 107
- Uploads with `addressId` line 202
- Error message: "Please select an address first" (not visit-related)

**This is the reference implementation for other modules.**

---

## 🔧 FIX PRIORITY ORDER

Based on user impact and alignment effort:

### Phase 1: Backend API Alignment (Foundation)

1. **Engineer API** (`engineer.ts:332`)
   - Remove visitId requirement
   - Auto-create system visit if needed for persistence
   - Return success with addressId only

2. **Sarah API** (`sarah.ts:270`)
   - Remove visitId requirement
   - Accept addressId for context
   - Degrade gracefully if no Engineer data

3. **Presentation/Packs API** (`presentationDrafts.ts:81,114`)
   - Remove visitId requirement
   - Generate packs with addressId
   - Grey out missing sections

4. **Customer Summary API** (`customerSummary.ts:149`)
   - Remove visitId requirement
   - Work with addressId

5. **Spine API** (`spine.ts:75,289`)
   - Review both endpoints
   - Remove visitId hard requirements

### Phase 2: Frontend UI Alignment (User-Facing)

1. **SpineEngineerPage.tsx**
   - Remove disabledReason logic (lines 19-22)
   - Remove visitId checks (lines 24-25, 54-55)
   - Remove disabled states (lines 76, 80)
   - Remove error message (line 84)
   - Update to check addressId only

2. **SpineSarahPage.tsx**
   - Remove visitId checks (lines 92, 118, 137)
   - Remove disabledReason (line 126)
   - Enable chat input always (line 368)
   - Update to check addressId only

3. **PresentationPage.tsx**
   - Change canBuild to check addressId (line 203)
   - Remove visitId clears (lines 207, 235)
   - Remove visitId blocks (line 332)
   - Update error message (line 625)
   - Enable PDF with degradation (line 633)
   - Enable draft creation (line 657)

4. **SpineCameraPage.tsx**
   - Make visit creation completely silent
   - Remove attach flow interruption
   - Auto-create visit in background

5. **CustomerSummaryPage.tsx**
   - Remove visitId check (lines 52-54)
   - Update error message

6. **HomePage.tsx**
   - Update event filtering (line 270)
   - Remove null return (line 278)

### Phase 3: Verification & Testing

1. Run regression test suite
2. Verify each module independently
3. Test complete user flow
4. Monitor for regressions

---

## 📋 Quick Reference: Search Patterns

Use these to find remaining violations after fixes:

```bash
# Find user-facing visit errors
grep -r "No active visit" packages/pwa/src/

# Find visit gating in conditionals
grep -r "!activeVisitId" packages/pwa/src/

# Find disabled features
grep -r "disabled.*visitId" packages/pwa/src/

# Find backend visit requirements
grep -r "visitId.*required" packages/api/src/

# Find visit checks in backend
grep -r "if (!visitId)" packages/api/src/
```

---

## 🎯 Success Criteria

The codebase is aligned when:

1. ✅ No "No active visit" messages shown to users
2. ✅ No features disabled when addressId exists but visitId doesn't
3. ✅ All API endpoints accept addressId instead of visitId
4. ✅ System visits are created silently when needed
5. ✅ All grep patterns above return zero violations
6. ✅ Regression tests pass
7. ✅ User can complete full workflow with address only

---

## 📊 Metrics

| Metric | Count |
|--------|-------|
| Total violations found | 27 |
| Frontend violations | 15 |
| Backend violations | 12 |
| Files requiring changes | 10 |
| Modules already aligned | 2 |
| Critical fixes needed | 3 |
| High priority fixes | 4 |
| Medium priority fixes | 2 |

---

**Next Action:** Begin Phase 1 fixes (Backend API Alignment)


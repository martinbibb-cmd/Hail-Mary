# 📋 GOLDEN PATH ALIGNMENT CHECKLIST

**Reference:** [GOLDEN_PATH.md](./GOLDEN_PATH.md)
**Status:** Implementation Tracking
**Last Updated:** 2026-01-24

This document tracks the concrete implementation work required to align the codebase to the Golden Path.

---

## 🎯 Objective

Systematically remove all visit-gating logic and ensure all features work with `addressId` as the sole anchor.

---

## 📊 Overall Status

| Module | Status | Blocker |
|--------|--------|---------|
| Photo Library | 🔴 NOT ALIGNED | Visit gating, persistence issues |
| Engineer | 🔴 NOT ALIGNED | Visit requirement |
| Sarah | 🔴 NOT ALIGNED | Disabled without visit/engineer |
| Diary | 🔴 NOT ALIGNED | Visit prerequisite |
| Packs/PDF | 🔴 NOT ALIGNED | Visit blocking |
| UI Mode | 🔴 NOT ALIGNED | Hybrid layouts |
| Dev Noise | 🔴 NOT ALIGNED | Build hash visible |

**Legend:**
- 🔴 NOT ALIGNED
- 🟡 IN PROGRESS
- 🟢 ALIGNED

---

## 🛠️ COPILOT INSTRUCTIONS

These are high-authority, copy-pasteable directives for immediate action.

---

### 🧭 COPILOT: GLOBAL COURSE CORRECTION

```
We are realigning the app to a single golden path.

Golden rule:
- activeAddressId is the ONLY required anchor
- activeVisitId must NEVER block UI or features
- Visits are optional and system-generated if needed

TASK:
Audit the codebase and remove any logic that:
- disables features when visitId is missing
- shows "No active visit" errors to users
- prevents feature access based on visit state

Search for:
- "No active visit"
- "!activeVisitId"
- "!visitId"
- "disabled={!visitId"
- "if (!visitId)"

Remove or refactor ALL instances.
```

---

### 📸 COPILOT: PHOTO LIBRARY (CRITICAL PRIORITY)

```
Fix Photo Library to align with Golden Path.

REQUIREMENTS:
1. Photos MUST be stored against addressId
2. visitId MUST be optional (nullable in DB)
3. Photos MUST persist across page reloads
4. Thumbnail URL and full image URL MUST be stored
5. Clicking thumbnail MUST open full-screen viewer

TASKS:
1. Update photo upload to only require addressId
2. Remove any visitId requirements from UI
3. Ensure backend stores:
   - thumbnail_url
   - full_url (or url)
   - address_id (required)
   - visit_id (nullable)
4. Implement proper rehydration on component mount
5. Verify upload → refresh → view workflow works

SEARCH FOR:
- Photo upload components
- "visitId" in photo-related code
- Photo gallery/viewer components

VERIFY:
- Upload photos with only address selected
- Refresh page
- Photos reappear
- Click thumbnail → full viewer opens
```

---

### 🛠 COPILOT: ENGINEER MODULE

```
Refactor Engineer module to remove visit dependency.

REQUIREMENTS:
1. Engineer MUST run with only addressId
2. If visitId is needed for backend persistence, auto-create silently
3. User MUST NEVER see visit-related errors

TASKS:
1. Remove visitId checks from Engineer UI
2. Update Engineer execution to accept only addressId
3. Add backend helper to auto-create system visit if needed:

   async function ensureVisitForPersistence(addressId) {
     const active = await getActiveVisit(addressId)
     if (active) return active.id

     return await createVisit({
       addressId,
       type: 'system',
       visibility: 'internal',
       created_by: 'system'
     })
   }

4. Update Engineer save logic to use helper
5. Remove any "No active visit" error messages

VERIFY:
- Select address (no visit)
- Open Engineer
- Run analysis
- Success (no errors)
```

---

### 🧠 COPILOT: SARAH MODULE

```
Refactor Sarah chat to enable immediately when address is selected.

REQUIREMENTS:
1. Sarah MUST be enabled when addressId exists
2. Sarah MUST respond without Engineer data (knowledge-only mode)
3. Sarah MUST NOT require visitId
4. Chat input MUST NEVER be disabled

TASKS:
1. Remove Engineer run requirement from Sarah UI
2. Remove visitId requirement from chat enablement
3. Implement graceful degradation:
   - If no Engineer data: Knowledge-only responses
   - If Engineer data exists: Context-aware responses
4. Update Sarah prompt to handle missing context gracefully
5. Remove any disabled states based on visit/engineer

VERIFY:
- Select address (no visit, no engineer run)
- Open Sarah
- Chat input is enabled
- Can send messages
- Sarah responds appropriately
```

---

### 📅 COPILOT: DIARY MODULE

```
Refactor Diary to remove visit prerequisites.

REQUIREMENTS:
1. Diary MUST work with only addressId
2. Booking an appointment CREATES a visit (not vice versa)
3. Date/time picker MUST open reliably

TASKS:
1. Remove any existing visit requirement from booking UI
2. Update appointment creation to:
   - Require addressId
   - Create visit as part of booking
3. Fix date/time picker click handlers
4. Ensure calendar opens on first click

VERIFY:
- Select address (no visit)
- Open Diary
- Click date picker → opens immediately
- Book appointment → success
- Visit is created as result of booking
```

---

### 📦 COPILOT: PACKS / PDF GENERATION

```
Refactor Packs and PDF generation to work with address only.

REQUIREMENTS:
1. Pack generation MUST work with only addressId
2. Sections requiring Engineer data should grey out if unavailable
3. PDF MUST generate with available data

TASKS:
1. Remove visitId requirement from pack generation
2. Implement graceful degradation:
   - If Engineer data exists: Full rich output
   - If no Engineer data: Grey out sections, show what's available
3. Update PDF template to handle missing sections
4. Enable pack button when address is selected

VERIFY:
- Select address (no engineer run)
- Open Packs
- Generate button is enabled
- Can generate basic pack
- Sections without data are greyed out
- If Engineer run → full pack available
```

---

### 🧱 COPILOT: UI MODE CONSISTENCY

```
Enforce single UI mode per device.

REQUIREMENTS:
1. Tablet UI: Touch devices + iPad
2. Desktop UI: Mouse + large viewport
3. NO hybrid layouts

TASKS:
1. Audit device detection logic
2. Ensure single mode is selected at app init
3. Remove any conditional feature hiding based on mode
4. Standardize breakpoints:
   - Tablet: Touch detection OR iPad user agent
   - Desktop: Mouse + viewport >= 1024px
5. Test on:
   - iPad (should be tablet mode)
   - Desktop browser (should be desktop mode)
   - Touch laptop (should be tablet mode)

VERIFY:
- Each device shows consistent UI
- No features hidden based on mode
- No layout switching mid-session
```

---

### 🧹 COPILOT: DEVELOPER NOISE CLEANUP

```
Move build hash and diagnostics out of primary UI.

REQUIREMENTS:
1. Build hash MUST be hidden by default
2. Diagnostics MUST be in Admin or ?dev=1 only
3. Production UI MUST be clean

TASKS:
1. Find build hash/label rendering
2. Add conditional rendering:
   - Show if: Admin page OR ?dev=1 in URL
   - Hide otherwise
3. Move diagnostics to Admin > Diagnostics section
4. Remove any dev-only UI from production views

VERIFY:
- Open app in production
- Build hash is NOT visible
- No diagnostic labels visible
- Visit /admin or add ?dev=1
- Dev info appears
```

---

## 🔍 Search Patterns for Quick Audit

Run these searches to find problematic code:

### Pattern 1: Visit Gating in UI

```bash
# Find disabled features based on visitId
grep -r "disabled.*visitId" packages/
grep -r "!activeVisitId" packages/
grep -r "if (!visitId)" packages/
```

### Pattern 2: Error Messages

```bash
# Find user-facing visit errors
grep -r "No active visit" packages/
grep -r "visit required" packages/ -i
grep -r "Please create a visit" packages/
```

### Pattern 3: Feature Locks

```bash
# Find conditional rendering based on visit
grep -r "{.*visitId.*&&" packages/
grep -r "visitId ? <" packages/
```

### Pattern 4: Photo Persistence

```bash
# Find photo-related code
grep -r "Photo" packages/ --include="*.tsx" --include="*.ts"
grep -r "photo.*upload" packages/ -i
grep -r "thumbnail" packages/
```

---

## 📝 Module-Specific Checklists

### ✅ Photo Library Checklist

- [ ] Remove `visitId` requirement from upload API
- [ ] Update photo schema to make `visit_id` nullable
- [ ] Store `thumbnail_url` in database
- [ ] Store `full_url` (or `url`) in database
- [ ] Implement photo fetch on component mount
- [ ] Fix gallery viewer to use stored URLs
- [ ] Test: Upload → Refresh → View
- [ ] Verify thumbnails load
- [ ] Verify full-screen viewer opens on click
- [ ] Check no "No active visit" errors

---

### ✅ Engineer Module Checklist

- [ ] Remove `visitId` check from Engineer button
- [ ] Update Engineer run API to accept only `addressId`
- [ ] Add backend `ensureVisitForPersistence` helper
- [ ] Update Engineer save to use helper
- [ ] Remove "No active visit" error messages
- [ ] Test: Select address → Open Engineer → Run
- [ ] Verify no visit-related errors
- [ ] Check Engineer results save correctly

---

### ✅ Sarah Module Checklist

- [ ] Remove Engineer run requirement from chat enablement
- [ ] Remove `visitId` requirement from Sarah UI
- [ ] Update Sarah prompt for graceful degradation
- [ ] Implement knowledge-only mode
- [ ] Implement context-aware mode (if Engineer data exists)
- [ ] Remove disabled state from chat input
- [ ] Test: Select address → Open Sarah → Chat
- [ ] Verify chat works without Engineer run
- [ ] Check responses are appropriate

---

### ✅ Diary Module Checklist

- [ ] Remove existing visit requirement from booking UI
- [ ] Update appointment creation to create visit
- [ ] Fix date picker click handler
- [ ] Fix time picker click handler
- [ ] Test: Select address → Open Diary → Book appointment
- [ ] Verify pickers open on first click
- [ ] Check appointment saves
- [ ] Confirm visit is created as result

---

### ✅ Packs/PDF Checklist

- [ ] Remove `visitId` requirement from pack generation
- [ ] Implement section greying for missing data
- [ ] Update PDF template for graceful degradation
- [ ] Enable pack button when address selected
- [ ] Test: Select address (no Engineer) → Generate pack
- [ ] Verify basic pack generates
- [ ] Check sections grey out appropriately
- [ ] Test with Engineer run → Full pack

---

### ✅ UI Mode Checklist

- [ ] Audit device detection logic
- [ ] Ensure single mode selection at init
- [ ] Remove conditional feature hiding
- [ ] Standardize tablet detection
- [ ] Standardize desktop detection
- [ ] Test on iPad
- [ ] Test on desktop browser
- [ ] Test on touch laptop
- [ ] Verify no hybrid layouts

---

### ✅ Dev Noise Checklist

- [ ] Find build hash rendering location
- [ ] Add conditional: Show only if Admin or `?dev=1`
- [ ] Move diagnostics to Admin section
- [ ] Remove dev labels from production
- [ ] Test in production mode
- [ ] Verify build hash hidden
- [ ] Test with `?dev=1`
- [ ] Verify dev info appears

---

## 🧪 Regression Test Suite

Run these tests after each module is aligned:

### Test 1: Fresh User Flow

1. Clear browser data
2. Open app
3. Navigate to Addresses
4. Create new address
5. **Expected:** All modules unlock, no errors

### Test 2: Photo Persistence

1. Select address
2. Upload 3 photos
3. Refresh page
4. **Expected:** Photos reappear
5. Click thumbnail
6. **Expected:** Full viewer opens

### Test 3: Engineer Without Visit

1. Select address
2. Open Engineer
3. Click "Run Analysis"
4. **Expected:** Engineer runs, no visit errors

### Test 4: Sarah Immediate Access

1. Select address
2. Open Sarah
3. Type message
4. **Expected:** Chat enabled, response received

### Test 5: Diary Booking

1. Select address
2. Open Diary
3. Click date picker
4. **Expected:** Opens immediately
5. Book appointment
6. **Expected:** Success

### Test 6: Pack Generation

1. Select address (no Engineer run)
2. Open Packs
3. Click "Generate Pack"
4. **Expected:** Basic pack generated
5. Run Engineer
6. Generate pack again
7. **Expected:** Full pack with analysis

---

## 🚨 Critical Invariants

These must NEVER be violated:

### Invariant 1: No Visit Errors to Users

```javascript
// ❌ FORBIDDEN
throw new Error("No active visit")
showMessage("Please create a visit first")
```

### Invariant 2: No Feature Disabling Based on Visit

```javascript
// ❌ FORBIDDEN
<Button disabled={!visitId}>Run Engineer</Button>
{visitId && <PhotoLibrary />}
```

### Invariant 3: No Hard Visit Dependencies

```javascript
// ❌ FORBIDDEN
if (!visitId) {
  return null
}
```

```javascript
// ✅ REQUIRED
if (!addressId) {
  return <SelectAddressPrompt />
}
```

---

## 📊 Progress Tracking

### Week 1 Goals

- [ ] Photo Library aligned and tested
- [ ] Engineer module aligned and tested
- [ ] Sarah module aligned and tested

### Week 2 Goals

- [ ] Diary module aligned and tested
- [ ] Packs/PDF aligned and tested
- [ ] UI mode consistency enforced

### Week 3 Goals

- [ ] Dev noise cleanup complete
- [ ] Full regression test suite passing
- [ ] Documentation updated

### Week 4 Goals

- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Monitor for regressions

---

## 🔄 Continuous Alignment

### Pre-Commit Checklist

Before committing any new feature:

- [ ] Does it require only `addressId`?
- [ ] Does it degrade gracefully if data is missing?
- [ ] Does it auto-create visits if needed (backend only)?
- [ ] Does it show appropriate messages (not "No active visit")?
- [ ] Is it tested without a visit?

### Code Review Checklist

When reviewing PRs:

- [ ] No `visitId` gating in UI
- [ ] No "No active visit" errors
- [ ] No disabled features based on visit
- [ ] Graceful degradation implemented
- [ ] Tests cover address-only scenario

---

## 📞 Escalation

If you encounter:

- Database schema conflicts
- Breaking changes
- Architectural uncertainties

**STOP and document the blocker here:**

### Current Blockers

| Module | Issue | Owner | Status |
|--------|-------|-------|--------|
| _(none yet)_ | | | |

---

## ✅ Definition of Done

A module is **ALIGNED** when:

1. ✅ Works with `addressId` only
2. ✅ No visit-related errors shown to users
3. ✅ Degrades gracefully if optional data missing
4. ✅ Regression tests pass
5. ✅ Documentation updated
6. ✅ Code review approved

---

## 🎯 Success Metrics

The alignment is **COMPLETE** when:

1. ✅ All modules show 🟢 ALIGNED status
2. ✅ Full regression test suite passes
3. ✅ No "No active visit" errors in logs
4. ✅ User testing shows no friction
5. ✅ Production deployment successful

---

**This checklist is the tactical companion to GOLDEN_PATH.md**
**Update status as modules are completed**


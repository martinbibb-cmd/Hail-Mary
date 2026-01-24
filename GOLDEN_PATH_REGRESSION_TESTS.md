# ✅ GOLDEN PATH REGRESSION TEST CHECKLIST

**Reference:** [GOLDEN_PATH.md](./GOLDEN_PATH.md)
**Purpose:** Prevent regressions and verify Golden Path alignment
**Date:** 2026-01-24

This document provides comprehensive test scenarios to verify Golden Path compliance.

---

## 🎯 Testing Philosophy

**Golden Path testing ensures:**
1. Features work with `addressId` only (no `visitId` required)
2. No "No active visit" errors appear
3. Graceful degradation when data is missing
4. System visits remain invisible to users
5. Data persists correctly across sessions

---

## 🧪 CRITICAL TEST SCENARIOS

These must pass for each feature module.

### Test Scenario 1: Fresh User Journey (The Golden Path)

**Objective:** Verify complete user flow without manual visit creation

**Prerequisites:**
- Clean database
- New user account
- No existing addresses or visits

**Steps:**
1. ✅ Launch application
   - **Expected:** Home screen loads
   - **Expected:** No errors, no warnings
   - **Expected:** No "No active visit" messages

2. ✅ Navigate to Addresses
   - **Expected:** Addresses page loads
   - **Expected:** Shows empty state or existing addresses

3. ✅ Create new address
   - Input: "123 Main Street", "SW1A 1AA"
   - **Expected:** Address created successfully
   - **Expected:** Address becomes active
   - **Expected:** Address banner appears

4. ✅ Upload photo
   - Navigate to Photo Library
   - **Expected:** Upload button is enabled
   - **Expected:** No "No active visit" error
   - Click "Add Photos"
   - Select photo file
   - **Expected:** Upload succeeds
   - **Expected:** Photo appears in library

5. ✅ Refresh page
   - **Expected:** Photo still visible
   - **Expected:** No data loss

6. ✅ Run Engineer
   - Navigate to Engineer
   - **Expected:** "Run Engineer" button is enabled
   - **Expected:** No "No active visit" message
   - Click "Run Engineer"
   - **Expected:** Engineer runs successfully
   - **Expected:** Output appears on timeline

7. ✅ Chat with Sarah
   - Navigate to Sarah
   - **Expected:** Chat input is enabled
   - **Expected:** No "No active visit" message
   - Type message: "What is a heat pump?"
   - **Expected:** Sarah responds
   - **Expected:** Response includes helpful content

8. ✅ Generate Pack
   - Navigate to Presentation/Packs
   - **Expected:** "Create Draft" button is enabled
   - **Expected:** No "No active visit" message
   - Click "Create Draft"
   - **Expected:** Draft created successfully
   - **Expected:** Can generate PDF

9. ✅ Book Appointment
   - Navigate to Diary
   - **Expected:** Calendar is visible
   - **Expected:** No "No active visit" message
   - Click date picker
   - **Expected:** Opens immediately (no delays)
   - Select date and time
   - **Expected:** Appointment created successfully

**Success Criteria:**
- ✅ All steps complete without visit-related errors
- ✅ User never saw "No active visit"
- ✅ User never manually created a visit
- ✅ All features worked immediately after selecting address

---

### Test Scenario 2: Address Only (No Visit)

**Objective:** Verify ALL features work with addressId but without visitId

**Prerequisites:**
- User logged in
- Address selected: `activeAddressId = "abc123"`
- No visit selected: `activeVisitId = null`

**Tests:**

#### 2.1 Photo Upload

```typescript
test('uploads photo with addressId only', async () => {
  setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
  setActiveVisitId(null)

  const file = createTestImage()
  await uploadPhoto(file)

  expect(uploadSuccess).toBe(true)
  expect(errorMessages).not.toContain(/visit/i)
})
```

**Manual Test:**
1. Select address
2. Ensure no visit is active
3. Upload photo
4. ✅ **Expected:** Upload succeeds
5. ✅ **Expected:** No visit error

---

#### 2.2 Engineer Run

```typescript
test('runs Engineer with addressId only', async () => {
  setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
  setActiveVisitId(null)

  const result = await runEngineer()

  expect(result.success).toBe(true)
  expect(result.eventId).toBeTruthy()
  expect(errorMessages).not.toContain(/visit/i)
})
```

**Manual Test:**
1. Select address
2. Ensure no visit is active
3. Click "Run Engineer"
4. ✅ **Expected:** Engineer runs
5. ✅ **Expected:** Output appears on timeline
6. ✅ **Expected:** No visit error

---

#### 2.3 Sarah Chat

```typescript
test('chats with Sarah with addressId only', async () => {
  setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
  setActiveVisitId(null)

  const reply = await sarahChat('What is a heat pump?')

  expect(reply).toBeTruthy()
  expect(reply.length).toBeGreaterThan(0)
  expect(errorMessages).not.toContain(/visit/i)
})
```

**Manual Test:**
1. Select address
2. Ensure no visit is active
3. Open Sarah
4. ✅ **Expected:** Chat input is enabled
5. Type message and send
6. ✅ **Expected:** Sarah responds
7. ✅ **Expected:** No visit error

---

#### 2.4 Pack Generation

```typescript
test('generates pack with addressId only', async () => {
  setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
  setActiveVisitId(null)

  const pack = await createPack()

  expect(pack.success).toBe(true)
  expect(pack.data.id).toBeTruthy()
  expect(errorMessages).not.toContain(/visit/i)
})
```

**Manual Test:**
1. Select address
2. Ensure no visit is active
3. Navigate to Presentation
4. ✅ **Expected:** "Create Draft" is enabled
5. Click "Create Draft"
6. ✅ **Expected:** Draft created
7. ✅ **Expected:** Can generate PDF (with placeholders for missing data)
8. ✅ **Expected:** No visit error

---

### Test Scenario 3: Graceful Degradation

**Objective:** Verify features show placeholders, not errors, when data is missing

**Prerequisites:**
- Address selected
- No Engineer run
- No photos uploaded
- No transcripts

**Tests:**

#### 3.1 Pack Without Engineer Data

**Manual Test:**
1. Select address (no Engineer run)
2. Navigate to Presentation
3. Create draft
4. ✅ **Expected:** Draft created successfully
5. View pack preview
6. ✅ **Expected:** Header section shows address
7. ✅ **Expected:** Engineer sections show placeholder: "Run Engineer for full analysis"
8. ✅ **Expected:** No error messages
9. ✅ **Expected:** PDF button is enabled

---

#### 3.2 Sarah Without Engineer Data

**Manual Test:**
1. Select address (no Engineer run)
2. Open Sarah chat
3. ✅ **Expected:** Chat input is enabled
4. Ask question: "What should I check for this property?"
5. ✅ **Expected:** Sarah responds with knowledge-only answer
6. ✅ **Expected:** Response explains Engineer hasn't run yet (if relevant)
7. ✅ **Expected:** No blocking error

---

#### 3.3 Pack Without Photos

**Manual Test:**
1. Select address (no photos uploaded)
2. Run Engineer
3. Generate pack
4. ✅ **Expected:** Pack generates successfully
5. ✅ **Expected:** "What we saw" section shows placeholder or is empty
6. ✅ **Expected:** Other sections with data are populated
7. ✅ **Expected:** No error

---

### Test Scenario 4: Data Persistence

**Objective:** Verify uploaded data persists across sessions

#### 4.1 Photo Persistence

**Manual Test:**
1. Select address
2. Upload 3 photos
3. ✅ **Expected:** Photos appear in library
4. Note photo URLs
5. Refresh page (F5)
6. ✅ **Expected:** 3 photos still visible
7. ✅ **Expected:** Same URLs as before
8. Click thumbnail
9. ✅ **Expected:** Full-screen viewer opens
10. ✅ **Expected:** Correct photo displays

**Automated Test:**
```typescript
test('photos persist across page refresh', async () => {
  const addressId = 'abc123'

  // Upload photos
  await uploadPhoto(testImage1)
  await uploadPhoto(testImage2)

  const photosBefore = await getPhotos(addressId)
  expect(photosBefore).toHaveLength(2)

  // Simulate page refresh
  await page.reload()

  const photosAfter = await getPhotos(addressId)
  expect(photosAfter).toHaveLength(2)
  expect(photosAfter[0].url).toBe(photosBefore[0].url)
  expect(photosAfter[1].url).toBe(photosBefore[1].url)
})
```

---

#### 4.2 Engineer Output Persistence

**Manual Test:**
1. Select address
2. Run Engineer
3. Note the summary and facts
4. Refresh page
5. Navigate to timeline
6. ✅ **Expected:** Engineer output still visible
7. ✅ **Expected:** Same content as before

---

### Test Scenario 5: System Visit Invisibility

**Objective:** Verify system-created visits are never shown to users

**Prerequisites:**
- Fresh address with no visits
- Monitor database and UI

**Tests:**

#### 5.1 Photo Upload Creates No Visible Visit

**Manual Test:**
1. Select fresh address
2. Open browser dev tools → Network
3. Upload photo
4. ✅ **Expected:** Upload succeeds
5. Check UI visit indicators (if any)
6. ✅ **Expected:** No new visit appears in UI
7. Check database (if access available)
8. ⚠️  **May exist:** System visit in database
9. ✅ **Expected:** System visit NOT in UI

---

#### 5.2 Engineer Run Creates No Visible Visit

**Manual Test:**
1. Select fresh address (no visits)
2. Run Engineer
3. ✅ **Expected:** Engineer succeeds
4. Check UI for visit indicators
5. ✅ **Expected:** No new visit shown to user
6. User should not be aware a visit was created

---

### Test Scenario 6: API Compliance

**Objective:** Verify all API endpoints accept addressId without visitId

#### 6.1 Engineer API

**Automated Test:**
```typescript
test('POST /api/engineer/run accepts addressId only', async () => {
  const response = await fetch('/api/engineer/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      addressId: 'abc123'
      // NO visitId
    })
  })

  expect(response.status).toBe(200)
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.error).not.toMatch(/visit.*required/i)
})
```

---

#### 6.2 Sarah API

**Automated Test:**
```typescript
test('POST /api/sarah/chat accepts addressId only', async () => {
  const response = await fetch('/api/sarah/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      addressId: 'abc123',
      message: 'What is a heat pump?',
      useKnowledgeBase: true
      // NO visitId
    })
  })

  expect(response.status).toBe(200)
  const json = await response.json()
  expect(json.reply).toBeTruthy()
  expect(json.error).not.toMatch(/visit.*required/i)
})
```

---

#### 6.3 Packs API

**Automated Test:**
```typescript
test('POST /api/presentation/drafts accepts addressId only', async () => {
  const response = await fetch('/api/presentation/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      addressId: 'abc123',
      title: 'Test Pack'
      // NO visitId
    })
  })

  expect(response.status).toBe(200)
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.error).not.toMatch(/visit.*required/i)
})
```

---

### Test Scenario 7: UI Hygiene

**Objective:** Verify UI follows Golden Path principles

#### 7.1 No Visit Errors

**Automated Test:**
```typescript
test('no visit errors in UI with address selected', async () => {
  setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
  setActiveVisitId(null)

  render(<App />)

  const allText = screen.getByRole('main').textContent || ''
  const visitErrors = [
    'no active visit',
    'visit required',
    'create a visit',
    'start a visit',
    'please create a visit'
  ]

  visitErrors.forEach(pattern => {
    expect(allText.toLowerCase()).not.toContain(pattern)
  })
})
```

**Manual Test:**
1. Select address
2. Navigate through all modules
3. ✅ **Expected:** No "No active visit" anywhere
4. ✅ **Expected:** No "Visit required" anywhere
5. ✅ **Expected:** No visit-related error messages

---

#### 7.2 No Disabled Features with Address

**Manual Test:**
1. Select address
2. Ensure no visit is active
3. Check all feature buttons:
   - "Run Engineer" button
   - "Add Photos" button
   - Sarah chat input
   - "Create Draft" button (Packs)
   - Diary date picker
4. ✅ **Expected:** ALL buttons are enabled
5. ✅ **Expected:** NO disabled states due to missing visit

---

#### 7.3 No Hybrid UI Modes

**Manual Test:**
1. Open on iPad
2. ✅ **Expected:** Tablet UI throughout
3. ✅ **Expected:** No desktop elements
4. Open on desktop browser
5. ✅ **Expected:** Desktop UI throughout
6. ✅ **Expected:** No tablet elements
7. ✅ **Expected:** No mixed layouts

---

#### 7.4 Dev Noise Hidden

**Manual Test:**
1. Open app in production mode
2. ✅ **Expected:** No build hash visible
3. ✅ **Expected:** No debug diagnostics
4. Add `?dev=1` to URL
5. ✅ **Expected:** Build hash now visible
6. ✅ **Expected:** Diagnostics accessible

---

### Test Scenario 8: Diary Booking

**Objective:** Verify diary works without existing visit

**Prerequisites:**
- Address selected
- No visit exists

**Manual Test:**
1. Navigate to Diary
2. ✅ **Expected:** Calendar visible
3. ✅ **Expected:** No "No visit" error
4. Click on a date
5. ✅ **Expected:** Date picker opens immediately (no delay)
6. Select time
7. Click "Book appointment"
8. ✅ **Expected:** Appointment created successfully
9. ✅ **Expected:** Confirmation shown
10. Verify: Appointment now appears in calendar
11. **Note:** This booking CREATED a visit (user may not see this)

---

## 🔄 REGRESSION TEST SUITE

Run these tests after EVERY module fix to prevent regressions.

### Regression Test 1: No "No Active Visit" Errors

```bash
# Search entire codebase
grep -r "No active visit" packages/pwa/src/ --include="*.tsx" --include="*.ts"

# Expected: ZERO results (except in test files or comments)
```

**Action if violations found:**
- Remove the error message
- Replace with address-based check
- Update to follow Golden Path

---

### Regression Test 2: No Visit-Gated Features

```bash
# Search for visit-based disabled states
grep -r "disabled.*visitId" packages/pwa/src/ --include="*.tsx"

# Expected: ZERO results
```

**Action if violations found:**
- Remove visit check from disabled condition
- Change to address-based check

---

### Regression Test 3: No Visit Requirements in APIs

```bash
# Search for visit requirements in backend
grep -r "visitId is required" packages/api/src/routes/

# Expected: ZERO results
```

**Action if violations found:**
- Change API to accept addressId
- Make visitId optional
- Auto-create system visit if needed

---

### Regression Test 4: Photo Persistence

**Automated Test:**
```bash
# Run automated photo persistence test
npm test -- --testNamePattern="photos persist"
```

**Expected:** All tests pass

---

### Regression Test 5: End-to-End Golden Path

**Automated Test:**
```bash
# Run full E2E test
npm run test:e2e -- --spec=golden-path.spec.ts
```

**E2E Test Script:**
```typescript
// tests/e2e/golden-path.spec.ts
describe('Golden Path E2E', () => {
  it('completes full user journey without visit errors', async () => {
    // 1. Create address
    await createAddress({ line1: '123 Main St', postcode: 'SW1A 1AA' })

    // 2. Upload photo
    const photoResult = await uploadPhoto(testImage)
    expect(photoResult.success).toBe(true)

    // 3. Run Engineer
    const engineerResult = await runEngineer()
    expect(engineerResult.success).toBe(true)

    // 4. Chat with Sarah
    const sarahResult = await sarahChat('What is a heat pump?')
    expect(sarahResult.reply).toBeTruthy()

    // 5. Generate pack
    const packResult = await createPack()
    expect(packResult.success).toBe(true)

    // 6. Book appointment
    const diaryResult = await bookAppointment(tomorrow, '14:00')
    expect(diaryResult.success).toBe(true)

    // 7. Verify no visit errors
    const errors = await getAllPageErrors()
    const visitErrors = errors.filter(e => /visit/i.test(e))
    expect(visitErrors).toHaveLength(0)
  })
})
```

---

## 📋 PRE-RELEASE CHECKLIST

Before deploying to production, verify:

### Critical Checks

- [ ] ✅ All regression tests pass
- [ ] ✅ E2E Golden Path test passes
- [ ] ✅ No "No active visit" errors in codebase
- [ ] ✅ No visit-gated features
- [ ] ✅ All APIs accept addressId without visitId
- [ ] ✅ Photos persist across refresh
- [ ] ✅ Engineer runs without visit
- [ ] ✅ Sarah responds without visit
- [ ] ✅ Packs generate without visit
- [ ] ✅ Diary books without existing visit

### Module-Specific Checks

**Photo Library:**
- [ ] Upload works with address only
- [ ] Photos persist after refresh
- [ ] Thumbnails load correctly
- [ ] Full viewer opens on click
- [ ] No visit errors

**Engineer:**
- [ ] Runs with address only
- [ ] No "No active visit" message
- [ ] Button is enabled with address
- [ ] Output appears on timeline
- [ ] No visit errors

**Sarah:**
- [ ] Chat enabled with address only
- [ ] Responds without Engineer data
- [ ] Input never disabled
- [ ] Graceful degradation works
- [ ] No visit errors

**Presentation/Packs:**
- [ ] Drafts created with address only
- [ ] Pack generates with missing data
- [ ] Placeholders shown for missing sections
- [ ] PDF button enabled
- [ ] No visit errors

**Diary:**
- [ ] Calendar loads with address only
- [ ] Date picker opens immediately
- [ ] Booking creates appointment
- [ ] No visit errors

### UI/UX Checks

- [ ] No hybrid UI modes
- [ ] Build hash hidden by default
- [ ] Dev info only with `?dev=1`
- [ ] Single consistent device mode
- [ ] No visit-related error messages
- [ ] Address-based messaging only

---

## 🚨 FAILURE PROTOCOLS

### If a regression test fails:

1. **STOP** - Do not deploy
2. **Identify** - Find the violation
3. **Fix** - Realign to Golden Path
4. **Re-test** - Run full regression suite
5. **Document** - Update this checklist if needed

### If "No active visit" appears:

1. **Priority: CRITICAL**
2. Immediate fix required
3. Find all instances
4. Replace with address-based logic
5. Re-run all tests

### If feature is disabled based on visit:

1. **Priority: HIGH**
2. Remove visit check
3. Add address check instead
4. Ensure graceful degradation
5. Test the feature flow

---

## 📊 TEST COVERAGE GOALS

| Module | Unit Tests | Integration Tests | E2E Tests | Current | Target |
|--------|-----------|-------------------|-----------|---------|--------|
| Photo Library | ✅ | ✅ | ✅ | 90% | 95% |
| Engineer | ⚠️ | ⚠️ | ❌ | 40% | 95% |
| Sarah | ⚠️ | ⚠️ | ❌ | 35% | 95% |
| Presentation | ⚠️ | ❌ | ❌ | 30% | 95% |
| Diary | ❓ | ❓ | ❓ | ?% | 95% |

---

## 🎯 SUCCESS METRICS

The system is **regression-free** when:

1. ✅ All automated tests pass
2. ✅ E2E Golden Path test passes
3. ✅ Manual test scenarios complete without visit errors
4. ✅ Code scans find zero visit-gating violations
5. ✅ User testing shows no friction points
6. ✅ Production monitoring shows no visit-related errors

---

**Run these tests religiously. The Golden Path depends on it.**


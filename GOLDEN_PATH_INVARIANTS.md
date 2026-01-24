# ⚖️ GOLDEN PATH INVARIANTS

**Reference:** [GOLDEN_PATH.md](./GOLDEN_PATH.md)
**Purpose:** Immutable rules that must NEVER be violated
**Date:** 2026-01-24

These are the laws of the system. They must hold true at ALL times, in ALL modules, in ALL circumstances.

---

## 🔒 CRITICAL INVARIANTS

These invariants are **non-negotiable**. Violating them breaks the Golden Path.

### Invariant 1: Address is the Sole Anchor

```typescript
// ✅ ALWAYS TRUE
if (userHasSelectedAddress) {
  // ALL features must be available
  features.photos.enabled === true
  features.engineer.enabled === true
  features.sarah.enabled === true
  features.diary.enabled === true
  features.packs.enabled === true
}
```

**Statement:**
> If `activeAddressId` exists, then ALL core features are enabled.

**Violations:**
- ❌ Feature disabled when `addressId` present but `visitId` missing
- ❌ "Select a visit" message when address is selected
- ❌ Grayed out buttons when address exists

**Test:**
```typescript
describe('Invariant 1: Address is the Sole Anchor', () => {
  it('enables all features when address is selected', () => {
    setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })

    expect(engineerButton.disabled).toBe(false)
    expect(sarahChatInput.disabled).toBe(false)
    expect(photoUploadButton.disabled).toBe(false)
    expect(packsButton.disabled).toBe(false)
  })
})
```

---

### Invariant 2: Visit Never Blocks UI

```typescript
// ✅ ALWAYS TRUE
if (activeVisitId === null) {
  // User sees NO visit-related errors
  ui.errors.filter(e => e.includes('visit')).length === 0
  ui.disabledFeatures.filter(f => f.reason.includes('visit')).length === 0
}
```

**Statement:**
> The absence of `activeVisitId` NEVER causes user-visible errors or disabled features.

**Violations:**
- ❌ "No active visit" error message
- ❌ "Visit required to proceed" message
- ❌ Disabled button with tooltip "No visit"

**Test:**
```typescript
describe('Invariant 2: Visit Never Blocks UI', () => {
  it('shows no visit errors when visitId is null', () => {
    setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
    setActiveVisitId(null)

    const errors = screen.getAllByRole('alert')
    const visitErrors = errors.filter(e =>
      e.textContent.toLowerCase().includes('visit')
    )

    expect(visitErrors).toHaveLength(0)
  })
})
```

---

### Invariant 3: System Visits are Invisible

```typescript
// ✅ ALWAYS TRUE
for (const visit of visits) {
  if (visit.type === 'system') {
    // System visits are never shown in UI
    ui.displayedVisits.includes(visit) === false
    ui.visitSelectors.options.includes(visit) === false
  }
}
```

**Statement:**
> Visits created by the system for persistence are NEVER exposed to the user.

**Violations:**
- ❌ System visit appears in visit dropdown
- ❌ UI shows "Visit created" toast for system visit
- ❌ User sees system visit ID in address banner

**Test:**
```typescript
describe('Invariant 3: System Visits are Invisible', () => {
  it('does not display system visits in UI', async () => {
    // Trigger action that creates system visit
    await uploadPhoto({ addressId: 'abc123' })

    // Check UI
    const visitDropdown = screen.getByRole('combobox', { name: /visit/i })
    const options = within(visitDropdown).getAllByRole('option')
    const systemVisits = options.filter(opt =>
      opt.value.startsWith('sys_')
    )

    expect(systemVisits).toHaveLength(0)
  })
})
```

---

### Invariant 4: Graceful Degradation Always

```typescript
// ✅ ALWAYS TRUE
for (const feature of features) {
  if (!feature.hasRequiredData()) {
    // Feature shows degraded state, NOT error
    feature.state === 'degraded' || feature.state === 'partial'
    feature.state !== 'error'
    feature.state !== 'disabled'
  }
}
```

**Statement:**
> Missing optional data causes graceful degradation, NEVER errors or blocking.

**Violations:**
- ❌ Error modal when Engineer hasn't run
- ❌ Disabled pack generation when no photos
- ❌ Blocked PDF when engineer data missing

**Test:**
```typescript
describe('Invariant 4: Graceful Degradation Always', () => {
  it('shows placeholder when Engineer has not run', () => {
    setActiveAddress({ id: 'abc123', postcode: 'SW1A 1AA' })
    // Don't run Engineer

    render(<PacksPage />)

    const engineerSection = screen.getByText(/engineer analysis/i)
    const placeholder = within(engineerSection).getByText(
      /run engineer for full analysis/i
    )

    expect(placeholder).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

---

### Invariant 5: API Accepts addressId

```typescript
// ✅ ALWAYS TRUE for all API endpoints
async function apiEndpoint(req, res) {
  const { addressId } = req.body

  // addressId is sufficient for ALL operations
  if (!addressId) {
    return res.status(400).json({ error: 'addressId required' })
  }

  // visitId is optional
  const { visitId } = req.body
  // If visitId missing, may auto-create for persistence

  // Process request with addressId
  // ...
}
```

**Statement:**
> All API endpoints accept `addressId` as the primary required parameter. `visitId` is optional.

**Violations:**
- ❌ API returns 400 error when `visitId` missing
- ❌ API requires both `addressId` AND `visitId`
- ❌ API error message says "visitId is required"

**Test:**
```typescript
describe('Invariant 5: API Accepts addressId', () => {
  it('succeeds with addressId only', async () => {
    const response = await fetch('/api/engineer/run', {
      method: 'POST',
      body: JSON.stringify({
        addressId: 'abc123'
        // NO visitId
      })
    })

    expect(response.ok).toBe(true)
    const json = await response.json()
    expect(json.success).toBe(true)
  })

  it('does NOT require visitId', async () => {
    const response = await fetch('/api/engineer/run', {
      method: 'POST',
      body: JSON.stringify({
        addressId: 'abc123'
        // visitId explicitly omitted
      })
    })

    expect(response.status).not.toBe(400)
    const json = await response.json()
    expect(json.error).not.toMatch(/visitId.*required/i)
  })
})
```

---

## 🔐 DATA INVARIANTS

These ensure data integrity while following the Golden Path.

### Invariant 6: Photos Belong to Addresses

```sql
-- ✅ ALWAYS TRUE in database
SELECT COUNT(*) FROM photos WHERE address_id IS NULL;
-- Result: 0

-- visit_id may be null
SELECT COUNT(*) FROM photos WHERE visit_id IS NULL;
-- Result: >= 0 (allowed)
```

**Statement:**
> Every photo MUST have an `address_id`. `visit_id` is optional.

**Schema:**
```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  address_id UUID NOT NULL REFERENCES addresses(id), -- REQUIRED
  visit_id UUID REFERENCES visits(id), -- NULLABLE
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Invariant 7: Timeline Events May Have System Visits

```sql
-- ✅ ALLOWED in database
SELECT COUNT(*) FROM timeline_events e
JOIN visits v ON e.visit_id = v.id
WHERE v.type = 'system';
-- Result: >= 0 (system visits exist for persistence)

-- But system visits are never shown in UI
```

**Statement:**
> Timeline events may reference system visits for persistence, but these are internal only.

---

### Invariant 8: Address Can Exist Without Visits

```sql
-- ✅ ALWAYS ALLOWED
SELECT COUNT(*) FROM addresses a
LEFT JOIN visits v ON v.property_id = a.id
WHERE v.id IS NULL;
-- Result: >= 0 (addresses without visits are valid)
```

**Statement:**
> Addresses are independent entities. They don't require visits to be useful.

---

## 🎨 UI INVARIANTS

These ensure consistent user experience.

### Invariant 9: Single Error Message Pattern

```typescript
// ✅ ONLY allowed error when feature accessed without address
const ALLOWED_ERROR = "Please select an address to continue"

// ❌ FORBIDDEN error messages
const FORBIDDEN_ERRORS = [
  "No active visit",
  "Please create a visit first",
  "Visit required to proceed",
  "You must start a visit",
  "No visit selected"
]
```

**Statement:**
> The ONLY blocking message allowed is "Please select an address to continue".

**Test:**
```typescript
describe('Invariant 9: Single Error Message Pattern', () => {
  it('shows only address-related prompt when no address', () => {
    // No address selected
    setActiveAddress(null)

    const messages = screen.getAllByRole('status')
    const forbidden = [
      /no.*visit/i,
      /create.*visit/i,
      /visit.*required/i,
      /start.*visit/i,
      /visit.*selected/i
    ]

    messages.forEach(msg => {
      forbidden.forEach(pattern => {
        expect(msg.textContent).not.toMatch(pattern)
      })
    })

    // Should show address prompt instead
    expect(screen.getByText(/select.*address/i)).toBeVisible()
  })
})
```

---

### Invariant 10: No Hybrid UI Modes

```typescript
// ✅ ALWAYS TRUE
const detectedMode = detectDeviceMode()

if (detectedMode === 'tablet') {
  ui.layout === 'tablet'
  ui.layout !== 'desktop' && ui.layout !== 'mixed'
}

if (detectedMode === 'desktop') {
  ui.layout === 'desktop'
  ui.layout !== 'tablet' && ui.layout !== 'mixed'
}
```

**Statement:**
> UI mode must be EITHER tablet OR desktop, never a hybrid or mix.

**Test:**
```typescript
describe('Invariant 10: No Hybrid UI Modes', () => {
  it('uses single consistent mode', () => {
    const tabletElements = document.querySelectorAll('[data-mode="tablet"]')
    const desktopElements = document.querySelectorAll('[data-mode="desktop"]')

    if (tabletElements.length > 0) {
      expect(desktopElements.length).toBe(0)
    }

    if (desktopElements.length > 0) {
      expect(tabletElements.length).toBe(0)
    }
  })
})
```

---

### Invariant 11: Dev Noise Hidden by Default

```typescript
// ✅ ALWAYS TRUE in production
if (process.env.NODE_ENV === 'production' && !queryParams.has('dev')) {
  ui.buildHash.visible === false
  ui.diagnostics.visible === false
  ui.debugInfo.visible === false
}
```

**Statement:**
> Development information is hidden in production unless explicitly requested via `?dev=1`.

**Test:**
```typescript
describe('Invariant 11: Dev Noise Hidden by Default', () => {
  it('hides build hash in production', () => {
    process.env.NODE_ENV = 'production'
    delete window.location.search // No ?dev=1

    render(<App />)

    const buildHash = screen.queryByText(/build.*[a-f0-9]{7}/i)
    expect(buildHash).not.toBeInTheDocument()
  })

  it('shows dev info when ?dev=1 present', () => {
    window.history.pushState({}, '', '?dev=1')

    render(<App />)

    const buildHash = screen.queryByText(/build.*[a-f0-9]{7}/i)
    expect(buildHash).toBeVisible()
  })
})
```

---

## ⚡ BEHAVIOR INVARIANTS

These define expected system behavior.

### Invariant 12: Photos Persist Across Sessions

```typescript
// ✅ ALWAYS TRUE
const photosBeforeRefresh = await getPhotos(addressId)
await browser.refresh()
const photosAfterRefresh = await getPhotos(addressId)

photosBeforeRefresh.length === photosAfterRefresh.length
photosBeforeRefresh.every((photo, i) =>
  photo.url === photosAfterRefresh[i].url
)
```

**Statement:**
> Uploaded photos MUST persist and reappear after page refresh.

**Test:**
```typescript
describe('Invariant 12: Photos Persist Across Sessions', () => {
  it('reloads photos after refresh', async () => {
    const addressId = 'abc123'

    // Upload photo
    await uploadPhoto({ addressId, file: testImage })
    const photosBefore = await getPhotos(addressId)
    expect(photosBefore).toHaveLength(1)

    // Refresh page
    await page.reload()

    // Photos should still be there
    const photosAfter = await getPhotos(addressId)
    expect(photosAfter).toHaveLength(1)
    expect(photosAfter[0].url).toBe(photosBefore[0].url)
  })
})
```

---

### Invariant 13: Engineer Runs Without Manual Visit

```typescript
// ✅ ALWAYS TRUE
const addressId = 'abc123'
const visitId = null

const result = await runEngineer({ addressId, visitId })

result.success === true
// Visit may have been created internally, but operation succeeded
```

**Statement:**
> Engineer MUST run successfully with only `addressId`, regardless of visit state.

**Test:**
```typescript
describe('Invariant 13: Engineer Runs Without Manual Visit', () => {
  it('succeeds with addressId only', async () => {
    const addressId = 'abc123'

    const response = await fetch('/api/engineer/run', {
      method: 'POST',
      body: JSON.stringify({ addressId })
    })

    expect(response.ok).toBe(true)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.eventId).toBeTruthy()
  })
})
```

---

### Invariant 14: Sarah Responds Always

```typescript
// ✅ ALWAYS TRUE
const addressId = 'abc123'
const hasEngineerData = false

const response = await sarahChat({
  addressId,
  message: "What is a heat pump?"
})

response.success === true
response.reply.length > 0
// Sarah responds even without Engineer data
```

**Statement:**
> Sarah MUST respond to user messages whenever `addressId` exists, regardless of Engineer state.

**Test:**
```typescript
describe('Invariant 14: Sarah Responds Always', () => {
  it('responds without Engineer data', async () => {
    const addressId = 'abc123'
    // Don't run Engineer

    const response = await fetch('/api/sarah/chat', {
      method: 'POST',
      body: JSON.stringify({
        addressId,
        message: "What is a heat pump?",
        useKnowledgeBase: true
      })
    })

    expect(response.ok).toBe(true)
    const json = await response.json()
    expect(json.reply).toBeTruthy()
    expect(json.reply.length).toBeGreaterThan(0)
  })
})
```

---

### Invariant 15: Packs Generate with Degradation

```typescript
// ✅ ALWAYS TRUE
const addressId = 'abc123'
const hasEngineerData = false
const hasPhotos = false

const pack = await generatePack({ addressId })

pack.success === true
pack.sections.header.present === true // Address always present
pack.sections.engineerAnalysis.present === false // Gracefully degraded
pack.sections.engineerAnalysis.placeholder === "Run Engineer for full analysis"
```

**Statement:**
> Packs MUST generate with `addressId` only, showing placeholders for missing data.

**Test:**
```typescript
describe('Invariant 15: Packs Generate with Degradation', () => {
  it('generates pack without Engineer data', async () => {
    const addressId = 'abc123'

    const response = await fetch('/api/presentation/drafts', {
      method: 'POST',
      body: JSON.stringify({
        addressId,
        title: 'Test Pack'
      })
    })

    expect(response.ok).toBe(true)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBeTruthy()
  })
})
```

---

## 🔬 TESTING INVARIANTS

These ensure test quality.

### Invariant 16: Every Feature Has Address-Only Test

```typescript
// ✅ REQUIRED for every feature
describe('FeatureX', () => {
  it('works with addressId only (no visitId)', async () => {
    const addressId = 'abc123'
    setActiveAddress({ id: addressId })
    setActiveVisitId(null) // Explicitly null

    // Feature should work
    const result = await featureX.run()
    expect(result.success).toBe(true)
  })
})
```

**Statement:**
> Every feature MUST have a test that verifies it works with `addressId` but without `visitId`.

---

### Invariant 17: No Visit Errors in Test Output

```typescript
// ✅ ALWAYS TRUE
const testOutput = await runAllTests()

const visitErrors = testOutput.filter(line =>
  line.includes('No active visit') ||
  line.includes('visitId required') ||
  line.includes('create a visit')
)

visitErrors.length === 0
```

**Statement:**
> Test runs MUST NOT produce "visit required" errors or warnings.

---

## 🚨 VIOLATION DETECTION

### How to Detect Invariant Violations

Run these checks regularly:

```bash
# Check for "No active visit" errors
grep -r "No active visit" packages/ --include="*.tsx" --include="*.ts"

# Check for visit-gated features
grep -r "if (!visitId)" packages/ --include="*.tsx" --include="*.ts"

# Check for visit requirements in APIs
grep -r "visitId.*required" packages/api/src/routes/

# Check for disabled features based on visit
grep -r "disabled.*visitId" packages/pwa/src/
```

### Automated Invariant Checks

```typescript
// Add to CI/CD pipeline
describe('Golden Path Invariants', () => {
  it('has no "No active visit" errors in codebase', async () => {
    const files = await glob('packages/**/*.{ts,tsx}')
    const violations = []

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      if (content.includes('No active visit')) {
        violations.push(file)
      }
    }

    expect(violations).toHaveLength(0)
  })

  it('has no visitId requirements in API routes', async () => {
    const files = await glob('packages/api/src/routes/**/*.ts')
    const violations = []

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      if (content.includes('visitId is required')) {
        violations.push(file)
      }
    }

    expect(violations).toHaveLength(0)
  })
})
```

---

## 📋 INVARIANT COMPLIANCE MATRIX

| Invariant | Photo Library | Engineer | Sarah | Diary | Packs | Status |
|-----------|--------------|----------|-------|-------|-------|--------|
| #1: Address is Sole Anchor | ✅ | ❌ | ❌ | ❓ | ❌ | 20% |
| #2: Visit Never Blocks | ✅ | ❌ | ❌ | ❓ | ❌ | 20% |
| #3: System Visits Invisible | ✅ | ⚠️ | ⚠️ | ❓ | ⚠️ | 40% |
| #4: Graceful Degradation | ✅ | ❌ | ⚠️ | ❓ | ❌ | 30% |
| #5: API Accepts addressId | ✅ | ❌ | ❌ | ❓ | ❌ | 20% |
| #6: Photos Belong to Addresses | ✅ | N/A | N/A | N/A | N/A | 100% |
| #9: Single Error Pattern | ✅ | ❌ | ❌ | ❓ | ❌ | 20% |
| #12: Photos Persist | ⚠️ | N/A | N/A | N/A | N/A | 80% |
| #13: Engineer Runs w/o Visit | N/A | ❌ | N/A | N/A | N/A | 0% |
| #14: Sarah Responds Always | N/A | N/A | ❌ | N/A | N/A | 0% |
| #15: Packs w/ Degradation | N/A | N/A | N/A | N/A | ❌ | 0% |

**Overall Compliance:** 25% ⚠️

---

## ✅ COMPLIANCE TARGETS

### Phase 1 (Backend)
- [ ] Invariant #5: API Accepts addressId (all routes)
- [ ] Invariant #13: Engineer runs without visit
- [ ] Invariant #14: Sarah responds always
- [ ] Invariant #15: Packs generate with degradation

### Phase 2 (Frontend)
- [ ] Invariant #1: Address is sole anchor (all features)
- [ ] Invariant #2: Visit never blocks (all features)
- [ ] Invariant #4: Graceful degradation (all features)
- [ ] Invariant #9: Single error pattern (all features)

### Phase 3 (Polish)
- [ ] Invariant #3: System visits invisible
- [ ] Invariant #10: No hybrid UI modes
- [ ] Invariant #11: Dev noise hidden
- [ ] Invariant #12: Photos persist properly

---

**These invariants are immutable. They define the Golden Path.**


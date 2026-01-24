# 🧭 THE GOLDEN PATH

**Status:** Canonical Reference
**Authority:** Immutable
**Date Frozen:** 2026-01-24

This document defines the ONE TRUE PATH for the Hail Mary / Atlas system.
If a feature breaks this path, **the feature is wrong, not the user.**

---

## 🟡 Golden Rule

> **Everything meaningful anchors to an Address.**
> **Visits are optional, lightweight, and never block progress.**

---

## The Canonical User Journey

### STEP 0 — Launch

**User opens Atlas.**

```
activeAddressId = null
activeVisitId = null
```

**UI State:**
- No property selected
- Home shows modules
- Nothing is "broken"
- **No errors, no disabled features, no warnings**

---

### STEP 1 — Select or Add an Address (The Anchor)

**User navigates to:**
- Addresses module
- Selects existing property OR creates new

**System State:**

```javascript
activeAddressId = "abc123"
activeVisitId = null
```

**UI Effect:**
- ✅ Address banner appears
- ✅ ALL core modules unlock
- ✅ System is fully functional

**⚠️ Critical Point:**
This is where the current system should already work — **but doesn't.**

---

### STEP 2 — Capture Evidence (Order doesn't matter)

From this point, the user can do **any** of the following in **any order:**

#### 📸 Photo Library
- Upload photos
- Re-view uploaded photos
- **Requirement:** `addressId`
- **Requirement:** `visitId` = ❌ NONE

#### 🎙 Transcripts
- Paste text
- Upload files
- Record audio
- **Requirement:** `addressId`
- **Requirement:** `visitId` = ❌ NONE

#### 📐 Scans
- Upload LiDAR
- Upload 3D models
- **Requirement:** `addressId`
- **Requirement:** `visitId` = ❌ NONE

#### 📅 Diary
- Book appointments
- View schedule
- **Requirement:** `addressId`
- **Requirement:** `visitId` = ❌ NONE (diary creates visits, not vice versa)

---

### STEP 3 — Intelligence Layer (Engineer + Sarah)

#### 🛠 Engineer

**User opens Engineer module.**

**Behavior:**
- ✅ Runs immediately
- ✅ Uses all available data:
  - Address metadata
  - Photos (if uploaded)
  - Transcripts (if created)
  - Scans (if uploaded)

**Visit Handling:**

```javascript
if (!activeVisitId) {
  // System silently creates a soft visit for persistence
  activeVisitId = createSystemVisit(addressId)
}
```

**User never sees this.**
**User never blocks on this.**

---

#### 🧠 Sarah

**User opens Sarah chat.**

**Behavior:**
- ✅ Always available once address is selected
- ✅ Can answer:
  - "What should I check next?"
  - "What does this engineer output mean?"
  - "What are the clearances for X?"
  - General building physics questions

**Sarah NEVER blocks on:**
- ❌ Visit existence
- ❌ Engineer run completion
- ❌ Diary entry

**Sarah adapts to what exists:**
- Knowledge-only mode: If no Engineer data
- Context-aware mode: If Engineer data available
- **Always responds. Never disables.**

---

### STEP 4 — Outcome (Quotes & Packs)

**User generates outputs:**
- Quotes
- Packs
- PDFs

**Requirements:**
- ✅ Address = **REQUIRED**
- ✅ Engineer = Optional (enriches output)
- ❌ Visit = **IRRELEVANT TO USER**

**Behavior:**
- If Engineer has run → Full rich output
- If Engineer hasn't run → Graceful degradation (grey out sections, show what's available)
- **Never block on visit state**

---

### STEP 5 — Diary (Optional, Parallel)

**Diary is orthogonal to the main flow.**

- ✅ User can book a visit **before or after** everything else
- ✅ Diary entries link to `addressId`
- ✅ Visits are **organisational, not structural**

**Visits are:**
- Calendar entries
- Log entries
- Timestamps for billing/workflow

**Visits are NOT:**
- Gatekeepers
- Prerequisites
- Required for features

---

## 🧠 Mental Model

This table defines the correct conceptual model:

| Concept | What it IS | What it is NOT |
|---------|------------|----------------|
| **Address** | Permanent anchor for all work | A formality or optional field |
| **Visit** | A calendar/log entry for organisation | A gatekeeper or blocker |
| **Engineer** | Intelligence engine that processes available data | A visit report or visit-dependent module |
| **Sarah** | Guide & explainer available with address context | A locked chatbot requiring Engineer run |
| **Photos** | Evidence attached to address | Visit-only artifacts |
| **Transcripts** | Notes attached to address | Visit-dependent data |
| **Scans** | Spatial data attached to address | Visit-dependent uploads |
| **Diary** | Appointment scheduler for visits | A prerequisite for work |

---

## ⚠️ Critical Rules

### Rule 1: Never Block on Visit

```javascript
// ❌ WRONG
if (!activeVisitId) {
  showError("No active visit")
  disableFeature()
}

// ✅ CORRECT
if (!activeAddressId) {
  showMessage("Please select an address to continue")
  return
}
// Continue with feature...
```

### Rule 2: Degrade Gracefully

```javascript
// ❌ WRONG
if (!engineerData) {
  disableUI()
}

// ✅ CORRECT
if (!engineerData) {
  showPlaceholder("Run Engineer to see analysis")
  enableManualInput()
}
```

### Rule 3: Auto-Create Visits When Needed

```javascript
// ✅ CORRECT (backend persistence layer)
function saveEngineerRun(addressId, data) {
  let visitId = getActiveVisitId()

  if (!visitId) {
    // Silent system visit
    visitId = createSystemVisit(addressId, {
      type: 'system',
      source: 'engineer-auto'
    })
  }

  saveToDatabase(addressId, visitId, data)
}
```

### Rule 4: UI Must Never Expose Internal Constraints

**User should never see:**
- "No active visit"
- "Visit required to proceed"
- Disabled features due to missing `visitId`

**User should only see:**
- "Select an address to begin"
- Features that work immediately

---

## 🎯 Invariants (Things That Must Never Happen)

1. ❌ User sees "No active visit" error
2. ❌ Feature is disabled when `addressId` exists but `visitId` doesn't
3. ❌ Photo upload requires visit
4. ❌ Sarah chat requires Engineer run
5. ❌ Engineer module requires visit
6. ❌ Packs/PDFs blocked on visit state
7. ❌ Diary appointment requires existing visit
8. ❌ Hybrid tablet/desktop UI mode
9. ❌ Build hash visible in production without `?dev=1`

---

## 📐 State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ APP LAUNCH                                                  │
│ activeAddressId = null                                      │
│ activeVisitId = null                                        │
│                                                             │
│ ✅ Show: Home, navigation                                   │
│ ⏸  Grey out: Features requiring address context            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ ADDRESS SELECTED                                            │
│ activeAddressId = "abc123"                                  │
│ activeVisitId = null                                        │
│                                                             │
│ ✅ UNLOCK EVERYTHING:                                        │
│    - Photo Library (upload + view)                         │
│    - Transcripts (create + view)                           │
│    - Scans (upload + view)                                 │
│    - Engineer (run analysis)                               │
│    - Sarah (chat immediately)                              │
│    - Diary (book appointments)                             │
│    - Quotes (generate with available data)                 │
│    - Packs (generate with available data)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ VISIT AUTO-CREATED (if needed by backend)                  │
│ activeAddressId = "abc123"                                  │
│ activeVisitId = "system_xyz"                                │
│                                                             │
│ ✅ User experience: UNCHANGED                                │
│ ✅ Backend: Can persist to visit_id if schema requires      │
│ ✅ Visible to user: NEVER (unless explicitly viewing diary) │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 System Architecture Principles

### Principle 1: Address-Centric Storage

```sql
-- ✅ CORRECT: Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  address_id UUID NOT NULL REFERENCES addresses(id),
  visit_id UUID REFERENCES visits(id), -- NULLABLE
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ CORRECT: Transcripts table
CREATE TABLE transcripts (
  id UUID PRIMARY KEY,
  address_id UUID NOT NULL REFERENCES addresses(id),
  visit_id UUID REFERENCES visits(id), -- NULLABLE
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Principle 2: System Visits Are Invisible

```javascript
// ✅ CORRECT: System visit creation
async function ensureVisitForPersistence(addressId) {
  const existing = await getActiveVisit(addressId)
  if (existing) return existing.id

  return await createVisit({
    addressId,
    type: 'system',
    visibility: 'internal',
    created_by: 'system',
    created_at: new Date()
  })
}
```

### Principle 3: UI Degradation Hierarchy

```javascript
// ✅ CORRECT: Feature availability hierarchy
function getFeatureState(feature, context) {
  const { addressId, engineerData, visitId } = context

  // Level 1: Address required
  if (!addressId) {
    return {
      enabled: false,
      message: "Select an address to continue"
    }
  }

  // Level 2: Address present - feature enabled
  // (visitId is never checked for user-facing features)

  // Level 3: Optional data enrichment
  if (feature === 'packs' && !engineerData) {
    return {
      enabled: true,
      mode: 'degraded',
      message: "Run Engineer for full analysis in pack"
    }
  }

  return { enabled: true, mode: 'full' }
}
```

---

## 📋 Module-Specific Requirements

### Photo Library

**MUST:**
- ✅ Store photos against `addressId`
- ✅ Allow uploads with only `addressId`
- ✅ Persist thumbnail URL
- ✅ Persist full image URL
- ✅ Rehydrate on page reload
- ✅ Support full-screen viewer on thumbnail click

**MUST NOT:**
- ❌ Require `visitId` for upload
- ❌ Require `visitId` for viewing
- ❌ Lose photos on refresh

### Engineer

**MUST:**
- ✅ Enable when `addressId` exists
- ✅ Auto-create system visit if persistence requires it
- ✅ Use all available data (photos, transcripts, scans)

**MUST NOT:**
- ❌ Block on `visitId` existence
- ❌ Show "No active visit" to user
- ❌ Require manual visit creation

### Sarah

**MUST:**
- ✅ Enable when `addressId` exists
- ✅ Respond with knowledge-only answers if no Engineer data
- ✅ Respond with context-aware answers if Engineer data exists
- ✅ Never disable chat input

**MUST NOT:**
- ❌ Block on `visitId`
- ❌ Block on Engineer run completion
- ❌ Disable due to missing data

### Diary

**MUST:**
- ✅ Enable when `addressId` exists
- ✅ Create visit when appointment is booked
- ✅ Support date/time picker reliably

**MUST NOT:**
- ❌ Require existing `visitId` to book appointment
- ❌ Block on visit state

### Packs / PDF

**MUST:**
- ✅ Enable when `addressId` exists
- ✅ Generate with available data
- ✅ Grey out sections requiring Engineer data
- ✅ Show full output when Engineer has run

**MUST NOT:**
- ❌ Block on `visitId`
- ❌ Require Engineer run to generate basic output
- ❌ Disable completely due to missing data

---

## 🧹 UI/UX Hygiene

### Device Mode Enforcement

**MUST:**
- ✅ Tablet UI: Touch devices + iPad
- ✅ Desktop UI: Mouse + large viewport
- ✅ Single mode per device (no hybrid)

**MUST NOT:**
- ❌ Mix tablet + desktop UI
- ❌ Hide features based on device mode
- ❌ Conditional rendering based on viewport

### Developer Noise

**MUST:**
- ✅ Hide build hash by default
- ✅ Show diagnostics only in Admin or with `?dev=1`
- ✅ Clean production UI

**MUST NOT:**
- ❌ Show internal status in production
- ❌ Expose build labels to users
- ❌ Display dev diagnostics by default

---

## 🚫 Anti-Patterns to Eliminate

### Anti-Pattern 1: Visit Gating

```javascript
// ❌ NEVER DO THIS
if (!activeVisitId) {
  return <ErrorMessage>No active visit. Please create one.</ErrorMessage>
}
```

### Anti-Pattern 2: Silent Feature Disabling

```javascript
// ❌ NEVER DO THIS
<Button
  disabled={!activeVisitId}
  onClick={handleEngineerRun}
>
  Run Engineer
</Button>
```

### Anti-Pattern 3: Hard Dependencies

```javascript
// ❌ NEVER DO THIS
const canShowSarah = activeVisitId && engineerData && address
```

```javascript
// ✅ CORRECT
const canShowSarah = !!activeAddressId
```

### Anti-Pattern 4: Missing Persistence

```javascript
// ❌ NEVER DO THIS
const [photos, setPhotos] = useState([])
// (Lost on refresh)
```

```javascript
// ✅ CORRECT
const photos = usePhotos(addressId) // Fetched from backend
```

---

## ✅ Success Criteria

The Golden Path is correctly implemented when:

1. ✅ User selects address → All features unlock
2. ✅ User uploads photos → Photos persist and reappear on reload
3. ✅ User opens Engineer → Runs without visit
4. ✅ User opens Sarah → Chat works immediately
5. ✅ User books appointment → Diary works without existing visit
6. ✅ User generates pack → Works with address only
7. ✅ User never sees "No active visit" error
8. ✅ UI mode is consistent (no hybrid layouts)
9. ✅ Production UI is clean (no dev noise)

---

## 📖 Appendix: Why This Matters

### The Problem

The current system evolved with **visit-first thinking**:
- Features were built assuming visits exist
- Visit became an implicit requirement
- Users hit invisible walls
- Features "mysteriously" don't work

### The Solution

The Golden Path establishes **address-first thinking**:
- Address is the anchor
- Visits are created when needed
- Features work immediately
- System feels intuitive

### The Outcome

When aligned to the Golden Path:
- ✅ User experience is frictionless
- ✅ Backend can still use visits for persistence
- ✅ No breaking changes to data model
- ✅ Just removes invisible barriers

---

## 🔒 Document Status

- **Version:** 1.0.0
- **Status:** Canonical
- **Authority:** Immutable
- **Changes:** Require explicit approval
- **Scope:** Entire Atlas/Hail Mary system

---

**This is the path. All code must align to it.**


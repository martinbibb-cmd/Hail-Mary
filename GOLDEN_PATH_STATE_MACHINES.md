# 🔄 GOLDEN PATH STATE MACHINES

**Reference:** [GOLDEN_PATH.md](./GOLDEN_PATH.md)
**For:** Copilot implementation guidance
**Date:** 2026-01-24

This document defines formal state machines that all modules must follow.

---

## 🎯 Core State Machine

This is the fundamental state machine for the entire system.

```
┌─────────────────────────────────────────────────────────────────┐
│  STATE: NO_ADDRESS                                              │
│                                                                 │
│  State Variables:                                               │
│    activeAddressId = null                                       │
│    activeVisitId   = null                                       │
│                                                                 │
│  UI Behavior:                                                   │
│    ✅ Home/Navigation visible                                    │
│    ⏸  Feature modules show "Select address" placeholder         │
│    ⏸  No errors, no warnings                                    │
│                                                                 │
│  Allowed Actions:                                               │
│    → Navigate to Addresses module                               │
│    → View general help/documentation                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ User selects/creates address
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: ADDRESS_ACTIVE                                          │
│                                                                 │
│  State Variables:                                               │
│    activeAddressId = "abc123"  ✅ SET                            │
│    activeVisitId   = null      ⏸  NOT REQUIRED                  │
│                                                                 │
│  UI Behavior:                                                   │
│    ✅ Address banner visible                                     │
│    ✅ ALL feature modules unlocked                               │
│    ✅ No visit-related errors                                    │
│                                                                 │
│  Allowed Actions:                                               │
│    ✅ Upload photos                                              │
│    ✅ Create transcripts                                         │
│    ✅ Upload scans                                               │
│    ✅ Run Engineer                                               │
│    ✅ Chat with Sarah                                            │
│    ✅ Book diary appointments                                    │
│    ✅ Generate quotes                                            │
│    ✅ Generate packs/PDFs                                        │
│                                                                 │
│  Backend Behavior:                                              │
│    → Auto-creates system visit if needed for persistence        │
│    → User never sees visit creation                             │
│    → All operations succeed                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ (System auto-creates visit if needed)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  STATE: ADDRESS_ACTIVE_WITH_SYSTEM_VISIT                        │
│                                                                 │
│  State Variables:                                               │
│    activeAddressId = "abc123"  ✅ SET                            │
│    activeVisitId   = "sys_xyz" ✅ SET (system-generated)         │
│                                                                 │
│  UI Behavior:                                                   │
│    ✅ IDENTICAL to ADDRESS_ACTIVE state                          │
│    ⚠️  User does NOT see visit status                            │
│    ⚠️  Visit is internal backend detail                          │
│                                                                 │
│  Allowed Actions:                                               │
│    ✅ Same as ADDRESS_ACTIVE                                     │
│    ✅ No additional permissions granted                          │
│    ✅ No UI changes                                              │
│                                                                 │
│  Backend Behavior:                                              │
│    → Visit used for database persistence                        │
│    → Visit not exposed to UI                                    │
│    → Can query by addressId OR visitId                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📸 Photo Upload State Machine

```
┌──────────────────────────────────────┐
│  User clicks "Add Photo"             │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check state     │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   activeAddressId?    NO → Show message:
         │ YES              "Select address to continue"
         │                  (NOT "No active visit")
         ▼
┌──────────────────────────┐
│ Open photo picker        │
│ Enable upload UI         │
└──────────────────────────┘
         │
         │ User selects photo(s)
         ▼
┌──────────────────────────┐
│ Upload with addressId    │
│ (visitId = optional)     │
└──────────────────────────┘
         │
         ▼
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
 SUCCESS            ERROR
    │                  │
    ▼                  ▼
 Save to DB      Show error
 Refresh view    (NOT visit-related)
```

**Key Rules:**
1. ✅ ONLY check `activeAddressId`
2. ❌ NEVER check `activeVisitId`
3. ✅ Upload sends `addressId` (required)
4. ⏸  Upload sends `visitId` (optional, nullable)
5. ✅ Backend accepts photos with addressId only
6. ⏸  Backend may auto-create visit for timeline event
7. ✅ User never sees visit creation

---

## 🛠 Engineer State Machine

```
┌──────────────────────────────────────┐
│  User clicks "Run Engineer"          │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check state     │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   activeAddressId?    NO → Show message:
         │ YES              "Select address to continue"
         │                  (NOT "No active visit")
         ▼
┌──────────────────────────────────────┐
│ Frontend: Send addressId to API      │
└──────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│ Backend: Receive addressId           │
│                                      │
│ 1. Fetch address data                │
│ 2. Fetch photos by addressId         │
│ 3. Fetch transcripts by addressId    │
│ 4. Fetch scans by addressId          │
│                                      │
│ 5. Run Engineer analysis             │
│                                      │
│ 6. If visitId present → use it       │
│    If visitId missing → create one   │
│       visitId = createSystemVisit(   │
│         addressId,                   │
│         { type: 'system' }           │
│       )                              │
│                                      │
│ 7. Save EngineerOutput to timeline   │
│    with visitId for persistence      │
│                                      │
└──────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│ Frontend: Receive success            │
│ Display results                      │
│ (User never saw visit creation)      │
└──────────────────────────────────────┘
```

**Key Rules:**
1. ✅ UI checks ONLY `activeAddressId`
2. ✅ API accepts `addressId` (required)
3. ⏸  API accepts `visitId` (optional)
4. ✅ API auto-creates visit if needed
5. ✅ Visit creation is silent
6. ❌ NEVER show "No active visit" to user

---

## 🧠 Sarah Chat State Machine

```
┌──────────────────────────────────────┐
│  User opens Sarah                    │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check state     │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   activeAddressId?    NO → Show message:
         │ YES              "Select address to begin"
         │                  (NOT "No active visit")
         ▼
┌──────────────────────────────────────┐
│ Enable chat input                    │
│ Load context (if available)          │
└──────────────────────────────────────┘
         │
         │ User sends message
         ▼
┌──────────────────────────────────────┐
│ Determine response mode              │
└──────────────────────────────────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
Has Engineer  Has Address  Has Nothing
Output?       Only?        Useful?
    │         │            │
    ▼         ▼            ▼
Context-     Knowledge-   Suggest
Aware Mode   Only Mode    Actions
    │         │            │
    └────┬────┴────┬───────┘
         ▼         ▼
    Generate   Generate
    Response   Response
    with       without
    Citations  Citations
         │
         ▼
┌──────────────────────────────────────┐
│ Display response to user             │
│ (Always succeeds, never blocks)      │
└──────────────────────────────────────┘
```

**Key Rules:**
1. ✅ Chat enabled with `activeAddressId`
2. ❌ NEVER disable chat input
3. ✅ Degrade gracefully without Engineer data:
   - Mode 1: Context-aware (Engineer data available)
   - Mode 2: Knowledge-only (No Engineer data)
   - Mode 3: Suggestion mode (No address)
4. ✅ Always respond, never block
5. ❌ NEVER show "No active visit"

---

## 📦 Packs/PDF State Machine

```
┌──────────────────────────────────────┐
│  User clicks "Generate Pack"         │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check state     │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   activeAddressId?    NO → Show message:
         │ YES              "Select address to continue"
         │                  (NOT "No active visit")
         ▼
┌──────────────────────────────────────┐
│ Gather available data                │
│                                      │
│ ✅ Address info (required)            │
│ ⏸  Photos (optional)                 │
│ ⏸  Engineer output (optional)        │
│ ⏸  Transcripts (optional)            │
│                                      │
└──────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│ Build pack sections                  │
│                                      │
│ For each section:                    │
│   If data exists → Full render       │
│   If data missing → Grey out         │
│                                      │
│ Example:                             │
│   - Header: ✅ Always (has address)   │
│   - Photos: ✅/⏸ (if uploaded)        │
│   - Engineer: ✅/⏸ (if run)           │
│   - Summary: ✅/⏸ (if Engineer run)   │
│                                      │
└──────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│ Generate PDF                         │
│ - Full sections: rendered            │
│ - Missing sections: placeholder      │
│   "Run Engineer for full analysis"   │
│                                      │
└──────────────────────────────────────┘
```

**Key Rules:**
1. ✅ Pack generation enabled with `activeAddressId`
2. ✅ Graceful degradation for missing data
3. ❌ NEVER block on `activeVisitId`
4. ❌ NEVER block on Engineer run
5. ✅ Show what's available, grey out what's missing
6. ✅ Enable PDF button always (with degradation notice)

---

## 📅 Diary State Machine

```
┌──────────────────────────────────────┐
│  User opens Diary                    │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check state     │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   activeAddressId?    NO → Show message:
         │ YES              "Select address to begin"
         │                  (NOT "No active visit")
         ▼
┌──────────────────────────────────────┐
│ Show calendar UI                     │
│ Load existing appointments           │
│ (Filtered by addressId)              │
└──────────────────────────────────────┘
         │
         │ User clicks "Book appointment"
         ▼
┌──────────────────────────────────────┐
│ Open date/time picker                │
│ (Opens immediately, no checks)       │
└──────────────────────────────────────┘
         │
         │ User selects date/time
         ▼
┌──────────────────────────────────────┐
│ Create appointment                   │
│                                      │
│ Backend:                             │
│   1. Create Visit record             │
│      - addressId (required)          │
│      - scheduledAt (user's choice)   │
│      - type = "appointment"          │
│                                      │
│   2. Return success                  │
│                                      │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Display confirmation                 │
│ Refresh calendar view                │
└──────────────────────────────────────┘
```

**Key Rules:**
1. ✅ Diary enabled with `activeAddressId`
2. ❌ NEVER require existing visit to book
3. ✅ Booking creates the visit (not vice versa)
4. ✅ Date picker opens immediately on click
5. ❌ NEVER block on `activeVisitId`

---

## 🔄 System Visit Creation (Backend Only)

This state machine runs on the backend when persistence requires a visit.

```
┌──────────────────────────────────────┐
│ API receives request with:           │
│   - addressId (required)             │
│   - visitId (optional)               │
└──────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Check visitId   │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
    visitId present?   NO → Create system visit
         │ YES             │
         │                 ▼
         │        ┌────────────────────┐
         │        │ INSERT INTO visits │
         │        │   addressId        │
         │        │   type = 'system'  │
         │        │   visibility =     │
         │        │     'internal'     │
         │        │   created_by =     │
         │        │     'system'       │
         │        └────────────────────┘
         │                 │
         │                 │
         │                 ▼
         │        ┌────────────────────┐
         │        │ Get new visitId    │
         │        └────────────────────┘
         │                 │
         └────────┬────────┘
                  ▼
┌──────────────────────────────────────┐
│ Use visitId for database operation   │
│ (photos, events, timeline, etc.)     │
└──────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│ Return success to frontend           │
│ (DO NOT expose visitId in response)  │
└──────────────────────────────────────┘
```

**Key Rules:**
1. ✅ Create visit silently if needed
2. ✅ Visit type = 'system'
3. ✅ Visit visibility = 'internal'
4. ❌ NEVER expose system visits to UI
5. ❌ NEVER return "visitId required" error
6. ✅ Always accept addressId as sufficient

---

## 🧪 State Transition Examples

### Example 1: New User, First Photo

```
State: NO_ADDRESS
  → User navigates to Addresses
  → User creates address "123 Main St"
State: ADDRESS_ACTIVE (addressId=abc123, visitId=null)
  → User opens Photo Library
  → UI enabled (checked addressId only)
  → User uploads photo
  → Frontend sends { addressId: abc123, file: ... }
  → Backend receives upload
  → Backend creates system visit (visitId=sys_001)
  → Backend saves photo with addressId=abc123, visitId=sys_001
  → Backend returns success
State: ADDRESS_ACTIVE (addressId=abc123, visitId=sys_001) [User doesn't see visit]
  → User refreshes page
  → Photos reload by addressId
  → User sees uploaded photo
State: SUCCESS (User never knew visit was created)
```

### Example 2: Run Engineer Without Visit

```
State: ADDRESS_ACTIVE (addressId=abc123, visitId=null)
  → User clicks "Run Engineer"
  → UI checks: addressId? YES → proceed
  → Frontend sends { addressId: abc123 }
  → Backend receives request
  → Backend fetches data by addressId
  → Backend runs analysis
  → Backend checks: visitId? NO
  → Backend creates system visit (visitId=sys_002)
  → Backend saves EngineerOutput to timeline with visitId=sys_002
  → Backend returns { success: true, eventId: evt_123 }
State: ADDRESS_ACTIVE (addressId=abc123, visitId=sys_002) [User doesn't see visit]
  → Frontend navigates to Home
  → Home shows new Engineer event
  → User clicks event → sees analysis
State: SUCCESS (User never saw visit creation)
```

### Example 3: Sarah Chat Without Engineer

```
State: ADDRESS_ACTIVE (addressId=abc123, visitId=null)
  → User opens Sarah
  → UI checks: addressId? YES → enable chat
  → User types: "What's the minimum clearance for a boiler?"
  → Frontend sends { addressId: abc123, message: "...", useKB: true }
  → Backend receives request
  → Backend checks: Engineer data? NO
  → Backend switches to knowledge-only mode
  → Backend queries KB for "boiler clearance"
  → Backend returns answer with citations
State: ADDRESS_ACTIVE (no change)
  → Frontend displays answer
  → User sees helpful response
State: SUCCESS (No visit needed, graceful degradation)
```

---

## 🚫 Anti-Pattern State Machines

These are **WRONG** and must be eliminated.

### ❌ WRONG: Visit-Gated Feature

```
User clicks "Run Engineer"
     ↓
Check visitId?
     ↓
   ┌─┴─┐
   NO  YES
   ↓    ↓
Show  Proceed
error
"No active visit"
```
**Why wrong:** Blocks user, exposes internal concept

### ❌ WRONG: Visit-First Thinking

```
User wants to upload photo
     ↓
Check visit exists?
     ↓
   ┌─┴─┐
   NO  YES
   ↓    ↓
Force  Allow
visit  upload
creation
```
**Why wrong:** Visit is not a prerequisite

### ❌ WRONG: Hard Visit Dependency

```
User generates pack
     ↓
visitId present?
     ↓
   ┌─┴─┐
   NO  YES
   ↓    ↓
Disable Generate
button   pack
```
**Why wrong:** Should degrade gracefully

---

## ✅ CORRECT Pattern: Address-First with Degradation

```
User action
     ↓
Check addressId?
     ↓
   ┌─┴─┐
   NO  YES
   ↓    ↓
Show  Proceed
"Select with
address" available
         data
     ↓
Check optional data
     ↓
   ┌──┴──┐
Full  Partial
data   data
   ↓     ↓
Rich   Degraded
output  output
 with   with
 all    placeholders
sections
```

---

## 🎯 Validation Checklist

For each feature, verify these state transitions:

- [ ] NO_ADDRESS → shows "Select address", not "No visit"
- [ ] ADDRESS_ACTIVE → all features enabled
- [ ] System visit creation → silent, invisible to user
- [ ] Missing data → graceful degradation, not blocking
- [ ] No "No active visit" messages anywhere
- [ ] No disabled states based on visitId
- [ ] All APIs accept addressId (visitId optional)

---

**These state machines are law. Copilot must follow them exactly.**


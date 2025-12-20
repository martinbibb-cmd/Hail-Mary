# UI Visual Guide

This document describes the visual appearance and layout of the new UI components.

## 1. Lead Context Banner (Top of Every Page)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔹 Lead Context Banner (Purple Gradient Background)                │
│                                                                       │
│  John Smith   Lead #123   SW1A 1AA          Saved 14:23   [Save]   │
│  └─name       └─lead ID   └─postcode        └─status     └─button   │
│                                                                       │
│  (Click anywhere to open Lead Drawer)                                │
└─────────────────────────────────────────────────────────────────────┘
```

**No Active Lead State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ No active lead                            [Select Lead]          │
│  Select a lead to start working                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Status Variations:**
- `● Unsaved` (yellow chip) - Changes not saved
- `Saved 14:23` (green chip) - Last save time
- `⏳ Syncing...` (animated) - Save in progress
- `⚠️ Save Failed` (red chip) - Failed after 3 attempts → shows [Export JSON]

## 2. Lead Drawer (Opens from Banner Click)

```
                        ┌──────────────────────────────────────┐
                        │  Lead Selector              [X]      │
                        ├──────────────────────────────────────┤
                        │                                      │
                        │  CURRENT LEAD                        │
                        │  ┌────────────────────────────────┐  │
                        │  │ John Smith                      │ │
                        │  │ 123 Main St, SW1A 1AA          │ │
                        │  │ Status: qualified • Lead #123   │ │
                        │  │                     [📥 Export] │ │
                        │  └────────────────────────────────┘  │
                        │                                      │
                        │  [Search by name, postcode, ID...]  │
                        │                                      │
                        │  [+ New Lead]                        │
                        │                                      │
                        │  LEADS LIST                          │
                        │  ┌────────────────────────────────┐  │
                        │  │ Jane Doe                        │ │
                        │  │ 456 Oak Ave, W1J 5AB           │ │
                        │  │                         [new]   │ │
                        │  └────────────────────────────────┘  │
                        │  ┌────────────────────────────────┐  │
                        │  │ Bob Wilson (ACTIVE)             │ │
                        │  │ 789 Elm St, EC1A 1BB           │ │
                        │  │                   [contacted]   │ │
                        │  └────────────────────────────────┘  │
                        │                                      │
                        └──────────────────────────────────────┘
```

## 3. Bottom Dock (Fixed at Bottom, Always Visible)

```
                    ┌────────────────────────────────────────────┐
                    │                                            │
                    │                                            │
                    │         MAIN CONTENT AREA                  │
                    │         (80px bottom padding)              │
                    │                                            │
                    │                                            │
┌───────────────────────────────────────────────────────────────────┐
│                     BOTTOM DOCK                                   │
│                                                                   │
│   [🏠]     [🧠]      [🗓]      [📸]      [☰]                    │
│   Home    Sarah    Diary    Photos    More                       │
│   ^^^^    (active state with blue background)                    │
└───────────────────────────────────────────────────────────────────┘
```

**Dock Items (Left to Right):**
1. **Home** (🏠) - Navigate to home launcher
2. **Sarah** (🧠) - AI assistant tool
3. **Diary** (🗓) - Rocky / Visit notes (diary app)
4. **Photos** (📸) - Site photo capture
5. **More** (☰) - Opens side rail drawer

**Active State:** Blue background, darker icon color

## 4. More Drawer (Opens from Dock "More" Button)

```
                        ┌──────────────────────────────────────┐
                        │  More                        [X]     │
                        ├──────────────────────────────────────┤
                        │                                      │
                        │  🧲  Leads                        →  │
                        │      Pipeline & surveys              │
                        │                                      │
                        │  💷  Quotes                       →  │
                        │      Estimates & proposals           │
                        │                                      │
                        │  📂  Files                        →  │
                        │      Project documents               │
                        │                                      │
                        │  👤  Profile                      →  │
                        │      Account & preferences           │
                        │                                      │
                        │  ⚙️   Settings                    →  │
                        │      App configuration               │
                        │                                      │
                        └──────────────────────────────────────┘
```

## 5. Lead Guard (When No Lead Selected)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                                                                       │
│                              🔒                                       │
│                                                                       │
│                       No Active Lead                                  │
│                                                                       │
│         This feature requires an active lead.                         │
│                                                                       │
│                    [Select Lead]                                      │
│                                                                       │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Applied to:**
- /rocky (Rocky fact extraction)
- /sarah (Sarah AI assistant)
- /photos (Photo capture)

## 6. Home Page (Refactored - Functional Launcher)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Welcome back, John                                                  │
│  Workspace                                                           │
│                                                                       │
│  CORE WORKSPACE                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🧲   │ │ 👥   │ │ 💷   │ │ 📂   │ │ 👤   │ │ ⚙️   │           │
│  │Leads │ │Custom│ │Quotes│ │Files │ │Profil│ │Settin│           │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                                       │
│  SURVEY MODULES                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 🏠   │ │ 🔥   │ │ ⚠️   │ │ ♨️   │ │ ☀️   │ │ 🔌   │           │
│  │Proper│ │Boiler│ │Hazard│ │ Heat │ │Solar │ │  EV  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘           │
│                                                                       │
│  TOOLS                                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                              │
│  │ 🪨   │ │ 🧠   │ │ 🗓   │ │ 📸   │                              │
│  │Rocky │ │Sarah │ │Diary │ │Photos│                              │
│  └──────┘ └──────┘ └──────┘ └──────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Changes from Old Home:**
- ❌ Removed: "Pick a module to start your next job"
- ❌ Removed: "Desktop view uses classic icons..." explanations
- ❌ Removed: "Active lead/customer stays pinned..." hints
- ❌ Removed: Device type chips
- ❌ Removed: Section descriptions
- ✅ Kept: Clean section headers only
- ✅ Kept: All functional tiles
- ✅ Kept: Tool tiles (even though in dock, as per requirement)

## 7. Complete Layout Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔹 LEAD CONTEXT BANNER (Purple, Always Visible)                    │
│  John Smith • Lead #123 • SW1A 1AA       Saved 14:23   [Save]      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                                                                       │
│                      MAIN CONTENT AREA                                │
│                      (Routes render here)                             │
│                                                                       │
│                      - Home launcher                                  │
│                      - Leads list                                     │
│                      - Quote editor                                   │
│                      - Visit recording                                │
│                      - etc.                                           │
│                                                                       │
│                                                                       │
│                      (80px bottom padding)                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  BOTTOM DOCK (Fixed, Always Visible)                  │
│   [🏠]    [🧠]    [🗓]    [📸]    [☰]                               │
│   Home   Sarah   Diary  Photos   More                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Mobile (< 768px)
- Banner: Stacked layout (info on top, actions below)
- Dock: Compact spacing, smaller icons (56px width)
- Drawers: Full width (100%)
- Home tiles: Single column stack

### Tablet (768-1024px)
- Banner: Same as desktop
- Dock: Medium spacing (64px width)
- Drawers: 480px width
- Home tiles: 2-3 columns

### Desktop (> 1024px)
- Banner: Full horizontal layout
- Dock: Wider spacing (600px max width, centered)
- Drawers: 480px width (Lead), 380px width (More)
- Home tiles: Grid layout (6 columns for icons)
- Sidebar: Visible (if not focus mode)

## Color Scheme

**Lead Context Banner:**
- Background: Linear gradient (135deg, #667eea → #764ba2)
- Text: White
- Status chips: Semi-transparent backgrounds

**Bottom Dock:**
- Background: White
- Border: #e0e0e0 (top border)
- Active state: #e3f2fd (light blue)
- Icon color: #666 (inactive), #667eea (active)

**Drawers:**
- Background: White
- Overlay: rgba(0, 0, 0, 0.5)
- Header: White (More), Purple gradient (Lead)
- Hover states: #f5f5f5

**Lead Guard:**
- Icon: Opacity 0.5
- Text: #333 (title), #666 (message)
- Button: Purple gradient

## Animations

1. **Drawers:** Slide in from right (0.3s ease)
2. **Overlay:** Fade in (0.2s ease)
3. **Dock hover:** translateY(-2px), scale
4. **Banner syncing:** Pulse animation (2s infinite)
5. **Create lead form:** Slide up from bottom (0.3s ease)

## Interaction Flow

### Selecting a Lead:
1. User sees "No active lead" in banner
2. Clicks "Select Lead" button
3. Lead Drawer slides in from right
4. User searches or scrolls list
5. Clicks desired lead
6. Lead Drawer closes
7. Banner updates to show selected lead
8. Protected routes become accessible

### Saving Data:
1. User makes changes in Visit app
2. Lead store marks as dirty
3. Banner shows "● Unsaved"
4. On stop recording: enqueueSave() called
5. Banner shows "⏳ Syncing..."
6. Save succeeds: Banner shows "Saved HH:MM"
7. OR Save fails (3x): Banner shows "⚠️ Save Failed" + "Export JSON"

### Navigation Flow:
1. User taps dock icon
2. Route changes
3. Lead context preserved (same currentLeadId)
4. New page renders
5. Banner remains visible with same lead
6. User can access protected features

This visual guide describes all major UI components and their layouts without requiring screenshots.

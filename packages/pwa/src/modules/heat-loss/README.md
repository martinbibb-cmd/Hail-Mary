# Heat Loss Module - Atlas v1.2

**Confidence-Led Heat Loss Analysis UI**

A professional, mobile-first interface for room-by-room heat loss calculations with full audit trail and emitter adequacy checking.

---

## Overview

This module transforms Atlas from "a calculator that gives an answer" into "a tool that can defend how it got the answer."

### Key Features

- **Confidence-First UI**: Every result shows confidence score, source transparency, and next-best-action
- **Room-by-Room Breakdown**: Detailed transmission vs ventilation analysis
- **Emitter Adequacy**: Check radiator performance at 45°C, 55°C, and 75°C flow temps
- **Full Audit Trail**: Legal shield for every assumption and measurement
- **No-Friction Interface**: Mobile-first, one-thumb interactions, big tap targets

---

## Architecture

### Components

```
HeatLossApp (Main container)
├── HeatLossDashboard (Home screen)
│   ├── FlowTempToggle (45/55/75°C selector)
│   └── RoomCard[] (Grid of room summaries)
│
├── RoomDetail (Detail screen)
│   ├── Heat loss breakdown (transmission/ventilation/uplifts)
│   ├── Surfaces list (walls/windows with audit trail)
│   └── Adequacy strip (at all flow temps)
│
├── AuditDrawer (Transparency overlay)
│   └── Field-by-field source/confidence/timestamp
│
└── UpgradeConfidenceBottomSheet (Action picker)
    └── Context-aware actions (scan/confirm/attach)
```

### State Management

**Zustand Store** (`heatLossStore.ts`):
- Input data (rooms, walls, emitters)
- Calculation results
- UI state (selected flow temp, selected room)
- Derived summaries (room confidence, risk icons)

### Data Flow

```
User Input → Store → API Call → Calculations → Room Summaries → UI
                                      ↓
                                 Audit Trail
```

---

## API Integration

### POST `/api/atlas/calculate-heat-loss`

**Request:**
```json
{
  "rooms": [{ "room_id": "...", "dimensions": {...}, ... }],
  "walls": [{ "wall_id": "...", "room_id": "...", "area_m2": 10, ... }],
  "emitters": [{ "emitter_id": "...", "room_id": "...", ... }],
  "designConditions": {
    "design_external_temp_c": -3,
    "desired_internal_temp_c": 21
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "room_heat_losses": [...],
    "whole_house_heat_loss_kw": 12.8,
    "audit_trail": [...],
    ...
  }
}
```

### GET `/api/atlas/defaults`

Returns default values for design conditions, thermal bridging, airtightness, etc.

---

## Confidence System

### Scores

- **High (90)**: LiDAR scan, thermal camera, borescope
- **Medium (60)**: Manual measurement, recent satellite
- **Low (30)**: Assumptions, table lookups

### Colors

- **Green**: Confidence ≥ 80%
- **Amber**: Confidence 50-79%
- **Red**: Confidence < 50%

### Risk Icons

- 🧱 **Assumed Wall**: Construction type or U-value assumed
- 🪟 **Unknown Glazing**: Glazing type not measured
- ❄️ **Unheated Adjacent**: Temp model for garage/porch used

---

## Usage

### Basic Setup

```tsx
import { HeatLossApp } from './modules/heat-loss';

function App() {
  return <HeatLossApp />;
}
```

### Loading Data

```tsx
import { useHeatLossStore } from './modules/heat-loss';

function MyComponent() {
  const { setRooms, setWalls, setEmitters, calculateHeatLoss } = useHeatLossStore();

  useEffect(() => {
    setRooms(myRooms);
    setWalls(myWalls);
    setEmitters(myEmitters);
    calculateHeatLoss();
  }, []);

  return <HeatLossDashboard />;
}
```

### Demo Data

```tsx
import { loadDemoData } from './modules/heat-loss/demo';

// In browser console or dev mode
loadDemoData();
```

---

## File Structure

```
heat-loss/
├── HeatLossApp.tsx              # Main container
├── HeatLossDashboard.tsx        # Home screen
├── RoomCard.tsx                 # Room summary card
├── FlowTempToggle.tsx           # 45/55/75°C selector
├── RoomDetail.tsx               # Detail screen
├── AuditDrawer.tsx              # Audit trail overlay
├── UpgradeConfidenceBottomSheet.tsx  # Action picker
├── heatLossStore.ts             # Zustand state management
├── confidenceUtils.ts           # Confidence calculation helpers
├── types.ts                     # TypeScript interfaces
├── demo.ts                      # Sample data for testing
├── HeatLoss.css                 # Mobile-first styles
├── index.ts                     # Public exports
└── README.md                    # This file
```

---

## Design Principles

### 1. Confidence + Responsibility, Not Just Results

❌ **Bad**: "12.8kW"

✅ **Good**: "12.8kW (Confidence: 82%) - 6 surfaces measured, 2 assumed. Risk: 1 unheated-adjacent temp assumed. Next: Scan geometry."

### 2. Validation = Guardrails, Not Nagging

❌ **Bad**: "Error: Missing field"

✅ **Good**: "This result is provisional: glazing U-value assumed. [Confirm glazing type (10 sec)]"

### 3. Mobile-First, One-Thumb Interactions

- Big tap targets (min 44x44px)
- Minimal typing
- Context-aware actions
- Quick confirms (10-60 sec actions)

### 4. Show the Working

Every number has:
- Source (LiDAR/Manual/Assumed)
- Confidence score
- Timestamp
- Method notes

---

## Roadmap / TODOs

### Phase 1 ✅ (Complete)
- [x] Dashboard with confidence colors
- [x] Room detail with breakdown
- [x] Audit drawer
- [x] Upgrade confidence sheet
- [x] Flow temp toggle
- [x] API integration
- [x] Mobile-first CSS

### Phase 2 (Next)
- [ ] RoomPlan scan integration (iOS)
- [ ] Sarah voice integration (confirm wall type, etc.)
- [ ] Photo/thermal/borescope attachment
- [ ] Unheated adjacent temp model picker
- [ ] Wall/insulation type quick pickers

### Phase 3 (Future)
- [ ] Export to PDF (via Sarah)
- [ ] Golden test cases as presets
- [ ] Thermal overlay visualization
- [ ] Multi-property comparison
- [ ] Heat pump sizing wizard

---

## Golden Test Cases

Each test case should have:
1. Saved inputs (rooms/walls/emitters)
2. Expected output range
3. Confidence upgrade path demo

Example: "Red Room → 10-sec Confirm → Amber/Green + Stable Output"

---

## Testing

### Manual Testing

1. Load demo data: `loadDemoData()`
2. Check dashboard renders with confidence colors
3. Click a red room → should show upgrade actions
4. Toggle flow temp → adequacy badges update
5. Click room → see detail breakdown
6. Click surface "i" button → see audit trail

### Automated Testing (TODO)

```bash
npm test packages/pwa/src/modules/heat-loss
```

---

## Notes

- **Not a compliance certificate**: This tool assists with heat loss calculations but is not MCS certified. Always consult an accredited assessor for formal certification.
- **Confidence is king**: Prioritize showing confidence and assumptions over hiding complexity.
- **Field-first**: Every design decision optimizes for speed in the field (hands-free, minimal typing, quick confirms).

---

## Support

- Issues: https://github.com/martinbibb-cmd/Hail-Mary/issues
- Atlas API Docs: `/packages/shared/src/utils/atlas-heat-loss.ts`
- Heat Loss Types: `/packages/shared/src/types/heat-loss-survey.types.ts`

---

**Built with**: React 18, TypeScript, Zustand, CSS Modules
**Compatible with**: PWA (iOS/Android), Desktop browsers

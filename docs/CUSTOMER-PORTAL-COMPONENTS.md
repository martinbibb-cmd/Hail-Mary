# Hail Mary Customer Portal - Component List

## Overview

This document provides the complete component architecture for the Customer Portal PWA, covering AR visualisation, finance calculators, roadmap display, and ArUco marker integration.

---

## Component Hierarchy

```
📦 CustomerPortal
├── 📱 App Shell
│   ├── Navigation
│   ├── BottomTabBar
│   └── NotificationBanner
│
├── 🏠 Home Module
│   ├── WelcomeHero
│   ├── QuickStats
│   ├── NextActionCard
│   └── TimelinePreview
│
├── 📅 Roadmap Module
│   ├── TimelineFilter
│   ├── PhaseSection
│   ├── UpgradeCard
│   └── ProgressIndicator
│
├── 👁️ AR Module
│   ├── ARViewer
│   ├── MarkerScanner
│   ├── EquipmentSelector
│   ├── BeforeAfterSlider
│   └── MarkerDownloader
│
├── 💷 Finance Module
│   ├── QuoteSummary
│   ├── PaymentOptions
│   ├── FinanceCalculator
│   ├── ROIChart
│   └── CarbonSavings
│
├── 📋 Profile Module
│   ├── PropertyCard
│   ├── SystemsList
│   ├── CompletedUpgrades
│   ├── AppointmentsList
│   └── DocumentsLibrary
│
└── 🔧 Shared Components
    ├── Cards
    ├── Buttons
    ├── Sliders
    ├── Charts
    └── Modals
```

---

## Core Components

### 1. App Shell Components

#### `Navigation`
Top navigation bar with branding and user controls.

```typescript
interface NavigationProps {
  showBackButton?: boolean;
  title?: string;
  rightActions?: NavigationAction[];
}

interface NavigationAction {
  icon: string;
  label: string;
  onClick: () => void;
}
```

#### `BottomTabBar`
Primary navigation for mobile-first experience.

```typescript
interface TabItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

const tabs: TabItem[] = [
  { id: 'home', icon: '🏠', label: 'Home', route: '/' },
  { id: 'roadmap', icon: '📅', label: 'Roadmap', route: '/roadmap' },
  { id: 'ar', icon: '👁️', label: 'AR', route: '/ar' },
  { id: 'finance', icon: '💷', label: 'Finance', route: '/finance' },
  { id: 'profile', icon: '⚙️', label: 'Profile', route: '/profile' },
];
```

#### `NotificationBanner`
System-wide notifications and updates.

```typescript
interface NotificationBannerProps {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}
```

---

## Home Module Components

### `WelcomeHero`
Personalized greeting with property visual.

```typescript
interface WelcomeHeroProps {
  customerName: string;
  propertyImage?: string;
  propertyAddress: string;
  propertyType: string;
  currentSystem: string;
}
```

**Features:**
- Animated greeting on first load
- Property image with fallback placeholder
- Address display with property type badge
- Current heating system indicator

### `QuickStats`
At-a-glance metrics dashboard.

```typescript
interface QuickStatsProps {
  stats: StatItem[];
}

interface StatItem {
  id: string;
  icon: string;
  value: string | number;
  unit: string;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}

// Example usage
const stats: StatItem[] = [
  { id: 'savings', icon: '💷', value: 2340, unit: '£', label: 'Est. Savings' },
  { id: 'carbon', icon: '🌿', value: 1.2, unit: 't', label: 'CO₂/yr' },
  { id: 'efficiency', icon: '⚡', value: 45, unit: '%', label: 'Efficiency' },
];
```

### `NextActionCard`
Primary CTA for the customer's next step.

```typescript
interface NextActionCardProps {
  title: string;
  description: string;
  status: 'ready' | 'pending' | 'scheduled';
  scheduledDate?: Date;
  primaryAction: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}
```

### `TimelinePreview`
Compact roadmap visualization.

```typescript
interface TimelinePreviewProps {
  phases: TimelinePhase[];
  currentPhase: number;
  onPhaseClick: (phase: TimelinePhase) => void;
}

interface TimelinePhase {
  id: string;
  label: string;
  year: number;
  tech: string;
  icon: string;
  status: 'complete' | 'current' | 'future';
}
```

---

## Roadmap Module Components

### `TimelineFilter`
Filter and view controls for the roadmap.

```typescript
interface TimelineFilterProps {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  sortOrder: 'timeline' | 'priority' | 'cost';
  onSortChange: (sort: string) => void;
}

// Filter options
const filters = ['all', 'heating', 'solar', 'ev', 'insulation'];
```

### `PhaseSection`
Collapsible phase header with summary.

```typescript
interface PhaseSectionProps {
  phase: 'today' | '0-2yr' | '2-5yr' | '5-15yr';
  title: string;
  itemCount: number;
  totalCost: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}
```

### `UpgradeCard`
Individual upgrade/recommendation card.

```typescript
interface UpgradeCardProps {
  upgrade: UpgradeItem;
  onViewDetails: () => void;
  onViewAR: () => void;
  onViewFinance: () => void;
  onToggleInterest: () => void;
}

interface UpgradeItem {
  id: string;
  type: 'heat_pump' | 'boiler' | 'solar_pv' | 'battery' | 'ev_charger' | 'insulation' | 'cylinder';
  icon: string;
  title: string;
  description: string;
  make?: string;
  model?: string;
  estimatedCost: number;
  grantDeduction?: number;
  netCost: number;
  annualSavings: number;
  co2Reduction: number;
  status: 'current' | 'recommended' | 'interested' | 'scheduled' | 'completed';
  priority: 'high' | 'medium' | 'low';
  phase: 'today' | '0-2yr' | '2-5yr' | '5-15yr';
}
```

**Visual Features:**
- Technology-specific icons and colors
- Cost breakdown with grant highlight
- Savings and CO₂ badges
- Quick action buttons (AR, Finance, Details)
- Interest/wishlist toggle

### `ProgressIndicator`
Overall completion progress for each phase.

```typescript
interface ProgressIndicatorProps {
  phases: PhaseProgress[];
  totalCompleteness: number;
}

interface PhaseProgress {
  phase: string;
  completed: number;
  total: number;
  percentage: number;
}
```

---

## AR Module Components

### `ARViewer`
Main AR camera and visualization interface.

```typescript
interface ARViewerProps {
  mode: 'live' | 'marker' | 'gallery';
  selectedEquipment: Equipment | null;
  onEquipmentPlaced: (placement: EquipmentPlacement) => void;
  onCapture: (image: string) => void;
}

interface Equipment {
  id: string;
  type: string;
  name: string;
  model3D: string; // URL to glTF/GLB model
  dimensions: { width: number; height: number; depth: number };
  color?: string;
}

interface EquipmentPlacement {
  equipmentId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  timestamp: Date;
  image?: string;
}
```

**Technical Requirements:**
- WebXR API support (AR mode)
- Three.js for 3D rendering
- AR.js for marker detection
- Model-viewer fallback for non-AR devices

### `MarkerScanner`
ArUco marker detection and tracking.

```typescript
interface MarkerScannerProps {
  markers: MarkerDefinition[];
  onMarkerDetected: (marker: DetectedMarker) => void;
  onMarkerLost: (markerId: string) => void;
  showGuide: boolean;
}

interface MarkerDefinition {
  id: number; // ArUco marker ID
  type: 'equipment' | 'room' | 'surface';
  equipmentType?: string;
  label: string;
}

interface DetectedMarker {
  id: number;
  corners: [Point, Point, Point, Point];
  pose: { position: Vector3; rotation: Quaternion };
  confidence: number;
}
```

**ArUco Integration:**
- Uses ArUco 4x4_50 dictionary
- Real-time marker tracking
- Multiple simultaneous markers
- Stable pose estimation

### `EquipmentSelector`
Equipment picker for AR placement.

```typescript
interface EquipmentSelectorProps {
  availableEquipment: Equipment[];
  selectedEquipment: Equipment | null;
  onSelect: (equipment: Equipment) => void;
  showDimensions?: boolean;
}

// Default equipment catalog
const defaultEquipment: Equipment[] = [
  {
    id: 'hp-indoor',
    type: 'heat_pump',
    name: 'Heat Pump Indoor Unit',
    model3D: '/models/hp-indoor-unit.glb',
    dimensions: { width: 440, height: 850, depth: 350 },
  },
  {
    id: 'hp-outdoor',
    type: 'heat_pump',
    name: 'Heat Pump Outdoor Unit',
    model3D: '/models/hp-outdoor-unit.glb',
    dimensions: { width: 1100, height: 1200, depth: 450 },
  },
  {
    id: 'ev-charger',
    type: 'ev',
    name: 'EV Charger',
    model3D: '/models/ev-charger.glb',
    dimensions: { width: 200, height: 400, depth: 120 },
  },
  // ... more equipment
];
```

### `BeforeAfterSlider`
Interactive comparison slider.

```typescript
interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  initialPosition?: number; // 0-100
  showStats?: boolean;
  stats?: ComparisonStats;
}

interface ComparisonStats {
  beforeRating: string;
  afterRating: string;
  beforeCost: number;
  afterCost: number;
  savings: number;
  savingsPercent: number;
}
```

### `MarkerDownloader`
PDF generation and download for ArUco markers.

```typescript
interface MarkerDownloaderProps {
  markers: MarkerTemplate[];
  customerName: string;
  propertyAddress: string;
  onDownload: () => void;
}

interface MarkerTemplate {
  id: number;
  label: string;
  description: string;
  instructions: string[];
  pageSize: 'A4' | 'Letter';
}

// Generated PDF includes:
// - Company branding
// - Customer details
// - Individual marker pages with:
//   - ArUco marker image
//   - Equipment label
//   - Placement instructions
//   - QR code to open app
```

**PDF Structure:**
```
Page 1: Cover page with instructions
Page 2: Heat Pump Indoor Unit marker
Page 3: Heat Pump Outdoor Unit marker
Page 4: EV Charger marker
Page 5: Hot Water Cylinder marker
Page 6: Room scanner grid pattern
```

---

## Finance Module Components

### `QuoteSummary`
Overview of pricing and grants.

```typescript
interface QuoteSummaryProps {
  quote: QuoteDetails;
  showBreakdown?: boolean;
}

interface QuoteDetails {
  subtotal: number;
  grants: GrantItem[];
  totalGrants: number;
  netTotal: number;
  vatIncluded: boolean;
  validUntil: Date;
}

interface GrantItem {
  name: string;
  amount: number;
  type: 'BUS' | 'ECO4' | 'LA' | 'OTHER';
  status: 'confirmed' | 'pending' | 'applied';
}
```

### `PaymentOptions`
Payment method selector.

```typescript
interface PaymentOptionsProps {
  options: PaymentOption[];
  selectedOption: string;
  onSelect: (optionId: string) => void;
}

interface PaymentOption {
  id: string;
  type: 'full' | 'finance' | 'staged';
  title: string;
  description: string;
  amount: number;
  discount?: number;
  terms?: FinanceTerms;
  milestones?: StagedMilestone[];
}

interface FinanceTerms {
  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalPayable: number;
}

interface StagedMilestone {
  stage: string;
  percentage: number;
  amount: number;
  trigger: string;
}
```

### `FinanceCalculator`
Interactive finance customization.

```typescript
interface FinanceCalculatorProps {
  quoteTotal: number;
  minDeposit: number;
  maxDeposit: number;
  availableTerms: number[]; // months
  apr: number;
  onChange: (calculation: FinanceCalculation) => void;
}

interface FinanceCalculation {
  deposit: number;
  loanAmount: number;
  termMonths: number;
  apr: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayable: number;
}

// Internal components
// - DepositSlider
// - TermSelector
// - PaymentBreakdown
```

### `ROIChart`
Return on investment visualization.

```typescript
interface ROIChartProps {
  scenarios: ROIScenario[];
  timeframeYears: number;
  showPaybackPoint?: boolean;
}

interface ROIScenario {
  id: string;
  label: string;
  color: string;
  initialCost: number;
  annualCost: number;
  annualSavings: number;
}

// Chart features:
// - Cumulative cost lines
// - Break-even point marker
// - Interactive tooltips
// - Scenario toggle
```

**Visualization:**
- Line chart showing cumulative costs over time
- Multiple scenarios (e.g., Gas vs Heat Pump)
- Break-even point highlighted
- Interactive energy price assumptions

### `CarbonSavings`
Environmental impact visualization.

```typescript
interface CarbonSavingsProps {
  annualSavings: number; // tonnes CO₂
  upgrades: CarbonBreakdown[];
  timeframeYears: number;
}

interface CarbonBreakdown {
  upgrade: string;
  annualCO2: number;
  percentage: number;
}

// Visual equivalents
interface CarbonEquivalent {
  type: 'trees' | 'miles' | 'flights' | 'homes';
  icon: string;
  value: number;
  label: string;
}
```

---

## Profile Module Components

### `PropertyCard`
Property overview with photo.

```typescript
interface PropertyCardProps {
  property: PropertyDetails;
  onEdit?: () => void;
}

interface PropertyDetails {
  address: Address;
  image?: string;
  type: string;
  bedrooms: number;
  builtYear?: string;
  epcRating?: string;
  floorArea?: number;
}
```

### `SystemsList`
Current installed systems.

```typescript
interface SystemsListProps {
  systems: InstalledSystem[];
  onViewDetails: (systemId: string) => void;
}

interface InstalledSystem {
  id: string;
  type: 'heating' | 'hot_water' | 'cooling' | 'solar' | 'ev' | 'other';
  icon: string;
  name: string;
  make?: string;
  model?: string;
  installedDate?: Date;
  age?: number;
  status: 'good' | 'aging' | 'poor' | 'condemned';
}
```

### `CompletedUpgrades`
History of completed work.

```typescript
interface CompletedUpgradesProps {
  upgrades: CompletedUpgrade[];
  onViewCertificate: (upgradeId: string) => void;
}

interface CompletedUpgrade {
  id: string;
  date: Date;
  type: string;
  description: string;
  installer?: string;
  hasCertificate: boolean;
  warrantyUntil?: Date;
}
```

### `AppointmentsList`
Upcoming and past appointments.

```typescript
interface AppointmentsListProps {
  appointments: CustomerAppointment[];
  onReschedule: (appointmentId: string) => void;
  onGetDirections: (appointmentId: string) => void;
}

interface CustomerAppointment {
  id: string;
  date: Date;
  type: 'survey' | 'installation' | 'service' | 'followup';
  title: string;
  engineer?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  address?: Address;
}
```

### `DocumentsLibrary`
Document storage and access.

```typescript
interface DocumentsLibraryProps {
  documents: CustomerDocument[];
  onView: (documentId: string) => void;
  onDownload: (documentId: string) => void;
}

interface CustomerDocument {
  id: string;
  type: 'quote' | 'survey' | 'certificate' | 'warranty' | 'invoice' | 'manual' | 'other';
  name: string;
  uploadedDate: Date;
  size: number;
  url: string;
  thumbnailUrl?: string;
}
```

---

## Shared Components

### Cards

#### `BaseCard`
```typescript
interface BaseCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onClick?: () => void;
}
```

#### `InfoCard`
```typescript
interface InfoCardProps {
  icon?: string;
  title: string;
  subtitle?: string;
  value?: string | number;
  unit?: string;
  children?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}
```

#### `ActionCard`
```typescript
interface ActionCardProps {
  icon: string;
  title: string;
  description: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  status?: 'ready' | 'pending' | 'complete';
}
```

### Buttons

#### `Button`
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'small' | 'medium' | 'large';
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
```

#### `IconButton`
```typescript
interface IconButtonProps {
  icon: string;
  label: string; // accessibility
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  onClick: () => void;
}
```

#### `FAB` (Floating Action Button)
```typescript
interface FABProps {
  icon: string;
  label: string;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center';
  extended?: boolean;
}
```

### Sliders

#### `RangeSlider`
```typescript
interface RangeSliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  label: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  marks?: SliderMark[];
}

interface SliderMark {
  value: number;
  label: string;
}
```

#### `ComparisonSlider`
```typescript
interface ComparisonSliderProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  initialPosition?: number;
  onPositionChange?: (position: number) => void;
}
```

### Charts

#### `LineChart`
```typescript
interface LineChartProps {
  data: ChartDataset[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  annotations?: ChartAnnotation[];
}

interface ChartDataset {
  id: string;
  label: string;
  data: DataPoint[];
  color: string;
  fill?: boolean;
}

interface DataPoint {
  x: number | string | Date;
  y: number;
}

interface ChartAnnotation {
  type: 'line' | 'point' | 'box';
  value: number;
  label?: string;
  color?: string;
}
```

#### `BarChart`
```typescript
interface BarChartProps {
  data: BarDataset[];
  horizontal?: boolean;
  stacked?: boolean;
  showValues?: boolean;
}

interface BarDataset {
  label: string;
  value: number;
  color: string;
  icon?: string;
}
```

#### `DonutChart`
```typescript
interface DonutChartProps {
  data: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}
```

### Modals

#### `Modal`
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

#### `BottomSheet`
```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  snapPoints?: number[];
  children: React.ReactNode;
}
```

#### `ConfirmDialog`
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## State Management

### Global State (Zustand)

```typescript
interface CustomerPortalStore {
  // Customer data
  customer: Customer | null;
  property: Property | null;
  
  // Roadmap
  upgrades: UpgradeItem[];
  selectedPhase: string;
  
  // AR
  arMode: 'live' | 'marker' | 'gallery';
  selectedEquipment: Equipment | null;
  placements: EquipmentPlacement[];
  
  // Finance
  selectedPaymentOption: string;
  financeSettings: FinanceSettings;
  
  // UI
  activeTab: string;
  notifications: Notification[];
  isOffline: boolean;
  
  // Actions
  setCustomer: (customer: Customer) => void;
  addPlacement: (placement: EquipmentPlacement) => void;
  updateFinanceSettings: (settings: Partial<FinanceSettings>) => void;
  // ... more actions
}
```

---

## AR Technical Specifications

### 3D Model Requirements

| Model | Format | Poly Count | File Size | LOD |
|-------|--------|------------|-----------|-----|
| HP Indoor | glTF 2.0 | <50k | <2MB | 2 levels |
| HP Outdoor | glTF 2.0 | <80k | <3MB | 2 levels |
| EV Charger | glTF 2.0 | <30k | <1MB | 2 levels |
| Cylinder | glTF 2.0 | <20k | <1MB | 1 level |
| Boiler | glTF 2.0 | <40k | <2MB | 2 levels |
| Solar Panel | glTF 2.0 | <10k | <500KB | 1 level |

### ArUco Marker Specifications

| Property | Value |
|----------|-------|
| Dictionary | ARUCO_4X4_50 |
| Marker Size | 100mm x 100mm |
| Print DPI | 300 minimum |
| Border Width | 10mm white border |
| Material | Matte paper recommended |

### Supported AR Modes

| Mode | Technology | Compatibility |
|------|------------|---------------|
| WebXR AR | WebXR Device API | Chrome Android 81+, iOS 15+ |
| Marker AR | AR.js + ArUco | All modern browsers |
| Model Viewer | Google model-viewer | All modern browsers |

---

## Dependencies

### Core
- React 18.x
- TypeScript 5.x
- Vite 5.x
- React Router 6.x
- Zustand 4.x

### AR/3D
- Three.js 0.160+
- @google/model-viewer 3.x
- AR.js 3.x
- js-aruco 1.x

### Charts
- Chart.js 4.x
- react-chartjs-2 5.x

### UI
- Framer Motion 10.x
- date-fns 3.x

### PDF Generation
- jsPDF 2.x
- html2canvas 1.x

### PWA
- Workbox 7.x
- vite-plugin-pwa 0.17+

---

*Component List Version: 1.0*
*Last Updated: December 2024*

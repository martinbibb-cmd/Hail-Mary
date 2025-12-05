# Hail Mary - Visual Surveyor Architecture

**Version:** 1.0
**Date:** 2025-12-05
**Status:** Architecture Design - Pre-Implementation

---

## Vision Statement

**Hail Mary Visual Surveyor** is the camera-and-sensor companion to the core Hail Mary voice transcript system. It transforms photos, scans, and measurements into hard geometric and thermal data that feeds directly into the Home Profile and upgrade roadmap engine.

> **Core Principle:** One visit, one app, one brain → entire 15-year property upgrade plan with voice + visual + sensor data.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Sensor & API Modules](#3-sensor--api-modules)
4. [Core Data Models](#4-core-data-models)
5. [Module Specifications](#5-module-specifications)
6. [Travel Logging System](#6-travel-logging-system)
7. [New Upgrade Modules](#7-new-upgrade-modules)
8. [Implementation Phases](#8-implementation-phases)
9. [Technical Stack](#9-technical-stack)
10. [Security & Privacy](#10-security--privacy)

---

## 1. System Overview

### 1.1 What Is Visual Surveyor?

Visual Surveyor is **not a separate app** but a **mode/feature set** within the Hail Mary ecosystem that activates when you need to:

- **Capture geometry** (room dimensions, radiator sizes, window clearances)
- **Capture thermal data** (heat loss, cold bridges, underperforming equipment)
- **Capture site context** (roof orientation, access restrictions, parking)
- **Capture measurements** (laser distance, cable runs, heights)
- **Track travel** (mileage, routes, expense logging)

### 1.2 Two Halves, One System

```
┌─────────────────────────────────────────────────────────────┐
│                      HAIL MARY SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────┐           ┌────────────────────┐    │
│  │   CORE (Voice)     │           │  VISUAL SURVEYOR   │    │
│  │                    │           │                    │    │
│  │ • Voice transcript │◄─────────►│ • LiDAR scanning   │    │
│  │ • Helper chips     │  Shared   │ • ArUco markers    │    │
│  │ • Spec builder     │   Data    │ • IR/Thermal       │    │
│  │ • Roadmap engine   │  Models   │ • Google Earth     │    │
│  │                    │           │ • Bluetooth laser  │    │
│  │                    │           │ • Travel logging   │    │
│  └────────────────────┘           └────────────────────┘    │
│                                                               │
│              Same Session ID • Same Property                 │
│          Same HomeProfile • Same SystemSpecDraft             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 User Journey

**On-site survey workflow:**

1. **Talk first** → Hail Mary Core captures requirements via voice
2. **Point devices at things** → Visual Surveyor fills geometric/thermal gaps
3. **System merges** → Both feeds update the same `HomeProfile` and `SystemSpecDraft`
4. **Roadmap generated** → Upgrade engine sees complete picture (voice + visual)

---

## 2. Architecture Principles

### 2.1 Device Capability Detection

Visual Surveyor adapts based on device capabilities:

| Device Type | LiDAR | ArUco | Thermal | Laser | Maps |
|-------------|-------|-------|---------|-------|------|
| iPhone 12 Pro+ | ✅ | ✅ | ❌ | 🔶 BLE | ✅ |
| iPad Pro 2020+ | ✅ | ✅ | ❌ | 🔶 BLE | ✅ |
| iPhone SE / older | ❌ | ✅ | ❌ | 🔶 BLE | ✅ |
| Android flagship | 🔶 Some | ✅ | ❌ | 🔶 BLE | ✅ |
| + FLIR camera | 🔶 | ✅ | ✅ | 🔶 BLE | ✅ |
| + Bosch laser | 🔶 | ✅ | ❌ | ✅ | ✅ |

**Graceful degradation:**
- **No LiDAR?** → ArUco markers become primary measurement tool
- **No thermal camera?** → Skip thermal inspection mode, rely on visual/voice notes
- **No BLE laser?** → Manual entry with AR ruler overlay
- **No GPS?** → Manual travel log entry

### 2.2 Modularity

Each sensor/API is a **pluggable module** with:

```typescript
interface SensorModule {
  id: string;                    // 'lidar', 'aruco', 'thermal', etc.
  name: string;                  // "LiDAR Room Scanner"
  available: boolean;            // Device capability check
  modes: SurveyMode[];          // What you can do with this sensor
  dataTargets: string[];        // What parts of spec it writes to
}

interface SurveyMode {
  id: string;                    // 'room-scan', 'boiler-wall', etc.
  name: string;                  // "Scan Room Geometry"
  sensors: string[];            // ['lidar'] or ['aruco', 'camera']
  instructions: string;         // Step-by-step guide
  outputs: DataOutput[];        // What gets saved
}
```

### 2.3 Data Flow

```
┌──────────────┐
│  User Action │ (Point camera, press measure, mark on map)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Sensor Layer │ (LiDAR, Camera, BLE, GPS, Maps API)
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Processing Layer │ (Calibration, 3D reconstruction, geometry calc)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Geometry/Data   │ (Planes, dimensions, thermal anomalies, routes)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Data Service   │ (Maps sensor data → spec fields)
└──────┬───────────┘
       │
       ▼
┌──────────────────────────┐
│  HomeProfile + SpecDraft │ (Persistent storage, shared with Core)
└──────────────────────────┘
```

### 2.4 Session Continuity

Visual Surveyor **always operates within a survey session:**

```typescript
interface SurveySession {
  id: string;                           // "session_123"
  leadId: string;                       // "lead_5038xxxx"
  propertyId: string;
  status: 'in_progress' | 'completed';

  // Core data (voice)
  transcript: TranscriptSegment[];
  helperChips: HelperChip[];

  // Visual data
  geometryCaptures: GeometryCapture[];
  thermalCaptures: ThermalCapture[];
  siteContext: SiteContext;

  // Travel data
  travelLog?: TravelLogEntry;

  createdAt: Date;
  updatedAt: Date;
}
```

**Key rule:** You can switch between voice mode and visual mode freely, but **always** within the same session.

---

## 3. Sensor & API Modules

### 3.1 Module Registry

```typescript
// /visual/core/module-registry.ts

export const SENSOR_MODULES: SensorModule[] = [
  {
    id: 'lidar',
    name: 'LiDAR Scanner',
    available: checkLiDARAvailable(),
    modes: [
      { id: 'room-scan', name: 'Scan Room Geometry', ... },
      { id: 'loft-scan', name: 'Scan Loft Space', ... },
    ],
    dataTargets: [
      'homeProfile.rooms[].dimensions',
      'solarPv.roofUse.underside',
      'insulation.loft.geometry',
    ],
  },

  {
    id: 'aruco',
    name: 'ArUco Marker Calibration',
    available: true, // Camera always available
    modes: [
      { id: 'boiler-wall', name: 'Boiler Wall Clearance', ... },
      { id: 'radiator-size', name: 'Measure Radiator', ... },
      { id: 'window-clearance', name: 'Window/Flue Distance', ... },
      { id: 'ev-charger-wall', name: 'EV Charger Location', ... },
      { id: 'floor-plane', name: 'Floor Plane Calibration', ... },
    ],
    dataTargets: [
      'centralHeating.geometry.boilerWallPlane',
      'centralHeating.emitters.radiators[].dimensions',
      'centralHeating.flueClearances',
      'ev.parking.chargerWallPlane',
      'solarPv.roofUse.openings[]',
    ],
  },

  {
    id: 'thermal',
    name: 'Thermal/IR Camera',
    available: checkThermalCameraAvailable(),
    modes: [
      { id: 'wall-inspection', name: 'Wall Insulation Check', ... },
      { id: 'window-draught', name: 'Window/Door Leaks', ... },
      { id: 'radiator-performance', name: 'Radiator Temperature', ... },
      { id: 'hp-performance', name: 'Heat Pump Delta-T', ... },
    ],
    dataTargets: [
      'insulation.cavity.thermalAnomalies[]',
      'glazing.draughtIssues[]',
      'centralHeating.waterQuality.suspectedSludgeFromThermal',
      'airToAirHp.performanceIssues[]',
    ],
  },

  {
    id: 'maps',
    name: 'Google Earth / Maps',
    available: true,
    modes: [
      { id: 'roof-context', name: 'Site Overview & Roof', ... },
      { id: 'access-logistics', name: 'Access & Parking', ... },
    ],
    dataTargets: [
      'solarPv.roofUse.remoteRoofGeometry',
      'hazards.accessRestrictions',
      'logistics.parkingAndAccess',
    ],
  },

  {
    id: 'laser',
    name: 'Bluetooth Laser Measure',
    available: checkBluetoothLaserAvailable(),
    modes: [
      { id: 'linear-measure', name: 'Quick Distance Measure', ... },
    ],
    dataTargets: [
      'homeProfile.rooms[].dimensions',
      'centralHeating.emitters.radiators[].dimensions',
      'ev.parking.cableRouteSegments[]',
      'centralHeating.flueClearances.measuredDistances',
    ],
  },

  {
    id: 'travel',
    name: 'Travel Logger',
    available: checkGPSAvailable(),
    modes: [
      { id: 'auto-trip', name: 'Automatic Trip Tracking', ... },
      { id: 'manual-trip', name: 'Manual Trip Entry', ... },
    ],
    dataTargets: [
      'travelLog[]',
    ],
  },
];
```

### 3.2 Capability Detection

```typescript
// /visual/core/capability-detector.ts

export function detectDeviceCapabilities(): DeviceCapabilities {
  return {
    lidar: checkLiDARAvailable(),
    thermal: checkThermalCameraAvailable(),
    bluetooth: checkBluetoothAvailable(),
    gps: checkGPSAvailable(),
    camera: true, // Always assume camera
    gyroscope: checkGyroscopeAvailable(),
    accelerometer: checkAccelerometerAvailable(),
  };
}

function checkLiDARAvailable(): boolean {
  // iOS: Check for ARKit LiDAR support
  // Android: Check for ARCore Depth API
  if (Platform.OS === 'ios') {
    return ARKit.isLiDARSupported();
  }
  if (Platform.OS === 'android') {
    return ARCore.isDepthAPISupported();
  }
  return false;
}

function checkThermalCameraAvailable(): boolean {
  // Check for connected FLIR, Seek, or other thermal cameras
  // This would query USB/Lightning accessories or paired BLE devices
  return ThermalCamera.isConnected();
}

function checkBluetoothLaserAvailable(): Promise<boolean> {
  // Scan for known BLE laser measure devices
  // Bosch GLM, Leica DISTO, etc.
  const devices = await BluetoothLE.scan(['laser-measure']);
  return devices.length > 0;
}
```

---

## 4. Core Data Models

### 4.1 GeometryCapture

```typescript
interface GeometryCapture {
  id: string;
  sessionId: string;
  mode: string;                    // 'room-scan', 'boiler-wall', etc.
  sensor: 'lidar' | 'aruco' | 'laser';

  // Geometric data
  planes?: Plane[];                // Wall/floor/ceiling planes
  dimensions?: Dimensions;         // Width/height/depth
  points?: Point3D[];             // Point cloud (if LiDAR)

  // Calibration data (ArUco)
  markers?: DetectedMarker[];
  scale?: number;                 // mm per pixel

  // Metadata
  roomId?: string;
  targetEntity?: string;          // 'boiler', 'radiator_1', 'window_3'
  capturedAt: Date;
  capturedBy: string;             // userId

  // Photo reference
  photo?: {
    url: string;
    annotations?: Annotation[];   // Drawn measurements/notes
  };
}

interface Plane {
  id: string;
  type: 'wall' | 'floor' | 'ceiling';
  normal: Vector3;               // Normal vector
  center: Point3D;               // Center point
  bounds?: Point3D[];            // Boundary polygon
  area?: number;                 // m²
}

interface DetectedMarker {
  id: number;                    // ArUco marker ID
  corners: Point2D[];            // 4 corners in image space
  center: Point2D;
  worldPosition?: Point3D;       // After calibration
}

interface Dimensions {
  width?: number;                // mm
  height?: number;               // mm
  depth?: number;                // mm
  confidence: number;            // 0-1
}
```

### 4.2 ThermalCapture

```typescript
interface ThermalCapture {
  id: string;
  sessionId: string;
  mode: string;                   // 'wall-inspection', 'radiator-performance', etc.

  // Thermal image data
  thermalImage: {
    url: string;                  // S3/storage URL
    visualImage?: string;         // Corresponding visible light photo
    tempRange: { min: number; max: number }; // °C
    palette: string;              // 'ironbow', 'rainbow', etc.
  };

  // Annotations
  annotations: ThermalAnnotation[];

  // Metadata
  targetEntity?: string;          // 'wall_north', 'radiator_2', 'hp_outdoor'
  ambientTemp?: number;           // °C
  capturedAt: Date;
  capturedBy: string;
}

interface ThermalAnnotation {
  id: string;
  type: 'spot' | 'area' | 'line';
  points: Point2D[];
  avgTemp: number;                // °C
  minTemp?: number;
  maxTemp?: number;
  notes?: string;                 // "Cold bridge detected"
  severity?: 'low' | 'medium' | 'high';
}
```

### 4.3 SiteContext

```typescript
interface SiteContext {
  sessionId: string;
  propertyId: string;

  // Geographic data
  location: {
    lat: number;
    lng: number;
    address: string;
  };

  // Roof geometry (from satellite/maps)
  roofGeometry?: {
    facets: RoofFacet[];
    totalArea: number;            // m²
    obstacles: Obstacle[];        // Trees, chimneys, etc.
  };

  // Access & logistics
  access: {
    drivewayWidth?: number;       // m
    parkingAvailable: boolean;
    restrictions: string[];       // ["narrow alley", "no parking"]
    scaffoldAreas?: Polygon[];    // Marked on map
  };

  // Imagery
  satelliteImages: {
    url: string;
    date: Date;
    zoom: number;
    annotations?: MapAnnotation[];
  }[];

  capturedAt: Date;
}

interface RoofFacet {
  id: string;
  outline: Point2D[];             // Polygon on map
  azimuth: number;                // 0-360° (0=North)
  pitch: number;                  // degrees from horizontal
  area: number;                   // m²
  shading?: 'none' | 'partial' | 'heavy';
}

interface Obstacle {
  type: 'tree' | 'chimney' | 'dormer' | 'antenna' | 'building';
  location: Point2D;
  height?: number;                // m
  radius?: number;                // m (for trees)
  notes?: string;
}
```

### 4.4 TravelLogEntry

```typescript
interface TravelLogEntry {
  id: string;
  sessionId: string;
  leadId: string;

  // Trip data
  startTime: Date;
  endTime: Date;
  distanceKm: number;
  durationMinutes: number;

  // Route
  startPostcode: string;
  endPostcode: string;
  route?: GPSPoint[];             // If detailed tracking enabled

  // Classification
  purpose: 'site_visit' | 'materials_pickup' | 'supplier_meeting' | 'other';
  businessPortion: number;        // 0-1 (for mixed personal/business trips)

  // Expense calculation
  mileageRate: number;            // £/km (from settings)
  calculatedCost: number;         // £

  // Metadata
  notes?: string;
  exportedAt?: Date;              // When included in expense report
  createdBy: string;
}

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  accuracy?: number;              // meters
}
```

---

## 5. Module Specifications

### 5.1 LiDAR Module

**Purpose:** Capture room geometry, volumes, and 3D context.

**Capabilities:**
- Full room scan (walls, floor, ceiling)
- Object detection (windows, radiators, boiler position)
- Loft space mapping
- Volume calculations

**Output Targets:**
- `homeProfile.rooms[].dimensions` - Room L×W×H
- `homeProfile.rooms[].volume` - m³ (for heat loss calc)
- `solarPv.roofUse.underside` - Loft roof geometry
- `insulation.loft.geometry` - Loft floor area, access

**Modes:**

#### Mode: Room Scan

**Flow:**
1. User selects "Scan Room"
2. App shows AR preview with scan progress
3. User walks around room pointing device at walls/floor
4. LiDAR captures point cloud
5. App detects planes (walls, floor, ceiling)
6. User confirms/adjusts detected room bounds
7. System saves to `homeProfile.rooms[]`

**Technical:**
```typescript
// /visual/lidar/RoomScanMode.tsx
async function captureRoom(roomName: string) {
  const arSession = await ARKit.startSession({ worldTracking: true });
  const pointCloud: Point3D[] = [];

  // Accumulate points as user moves
  arSession.onFrame((frame) => {
    const newPoints = frame.rawFeaturePoints;
    pointCloud.push(...newPoints);
  });

  // Detect planes after sufficient data
  const planes = detectPlanes(pointCloud);
  const room = {
    name: roomName,
    dimensions: calculateDimensions(planes),
    volume: calculateVolume(planes),
    geometry: { planes, pointCloud },
  };

  await geometryService.saveRoom(sessionId, room);
}
```

**Data Written:**
```typescript
{
  homeProfile: {
    rooms: [
      {
        id: "room_living",
        name: "Living Room",
        type: "living",
        dimensions: { length: 5200, width: 4300, height: 2400 }, // mm
        volume: 53.664, // m³
        floorArea: 22.36, // m²
        geometry: {
          captureId: "geo_123",
          planes: [...],
          confidence: 0.92
        }
      }
    ]
  }
}
```

---

### 5.2 ArUco Marker Module

**Purpose:** Bring exact measurements to any device via printed calibration markers.

**Why ArUco?**
- Works on any phone (no LiDAR needed)
- Highly accurate (sub-millimeter if done right)
- Cheap (print markers on paper)
- Versatile (walls, floors, objects)

**Marker Patterns:**

We use **standardized patterns** for each measurement scenario:

| Pattern | Markers | Use Case | Spacing |
|---------|---------|----------|---------|
| **2-marker horizontal** | 2 | Simple width (rad, window) | 500mm |
| **4-corner rectangle** | 4 | Boiler wall, EV wall | 1000mm × 1000mm |
| **5-marker window** | 5 | Window opening + flue | Custom |
| **6-marker floor** | 6 | Floor plane + two walls | 1000mm × 1000mm |

**Modes:**

#### Mode: Boiler Wall Clearance

**Purpose:** Measure boiler position on wall + clearances to windows/corners.

**Flow:**
1. User selects "Boiler Wall Calibration"
2. App shows instruction: "Place 4 ArUco markers in rectangle around boiler (markers 0,1,2,3)"
3. User tapes markers to wall (1m × 1m rectangle)
4. App detects markers → computes wall plane + scale
5. User taps to mark boiler outline
6. User taps to mark window positions
7. App calculates clearances automatically

**Technical:**
```typescript
// /visual/markers/BoilerWallMode.tsx
async function calibrateBoilerWall() {
  const camera = await Camera.start();
  const aruco = new ArucoDetector({ dictionary: 'DICT_4X4_50' });

  // Wait for 4-marker pattern
  const markers = await aruco.detectPattern([0, 1, 2, 3], { timeout: 30000 });

  // Compute wall plane and scale
  const plane = computePlaneFromMarkers(markers);
  const scale = computeScale(markers, KNOWN_SPACING_MM);

  // AR overlay for annotations
  const annotations = await collectAnnotations(plane, scale);
  // User taps: boiler outline, window positions

  const clearances = calculateClearances(annotations);
  await geometryService.saveBoilerWall(sessionId, { plane, clearances });
}
```

**Data Written:**
```typescript
{
  centralHeating: {
    geometry: {
      boilerWallPlane: {
        captureId: "geo_boiler_wall",
        normal: [0, 0, 1],
        markers: [0, 1, 2, 3],
        scale: 0.245 // mm/pixel
      },
      boilerPosition: {
        x: 1250, y: 1800, // mm from marker 0
        width: 450, height: 780 // mm
      },
      flueClearances: {
        toWindowLeft: 850, // mm
        toWindowRight: 1200,
        toCeiling: 600,
        compliant: true
      }
    }
  }
}
```

#### Mode: Radiator Size

**Purpose:** Measure radiator dimensions for heat output validation.

**Flow:**
1. User selects "Measure Radiator"
2. App: "Place 2 markers horizontally (0, 1) at radiator base, 500mm apart"
3. User places markers
4. App detects → computes scale
5. User drags rectangle over radiator in camera view
6. App calculates W × H in mm

**Data Written:**
```typescript
{
  centralHeating: {
    emitters: {
      radiators: [
        {
          id: "rad_living_1",
          roomId: "room_living",
          dimensions: {
            width: 1200, // mm
            height: 600,
            depth: 100, // assumed or measured
            captureId: "geo_rad_1",
            confidence: 0.95
          },
          type: "double_panel_convector", // inferred from depth
          estimatedOutput: 2400 // W (calculated)
        }
      ]
    }
  }
}
```

---

### 5.3 Thermal/IR Module

**Purpose:** Detect heat loss, cold bridges, equipment performance issues.

**Supports:**
- FLIR One (Lightning/USB-C)
- Seek Thermal Compact
- Import from standalone thermal cameras

**Modes:**

#### Mode: Wall Insulation Check

**Flow:**
1. User connects thermal camera
2. Selects "Wall Insulation Check"
3. Points camera at exterior walls
4. App captures thermal + visible images
5. User taps to mark cold spots
6. App calculates temperature differential
7. Saves with severity rating

**Data Written:**
```typescript
{
  insulation: {
    cavity: {
      wallIssues: [
        {
          id: "thermal_wall_north_1",
          location: "North wall, living room",
          captureId: "thermal_123",
          avgTemp: 14.2, // °C
          ambientTemp: 20.0,
          deltaT: -5.8,
          severity: "high", // <-6°C = high
          notes: "Cold stripe suggests missing cavity insulation",
          photo: "s3://..."
        }
      ]
    }
  }
}
```

#### Mode: Radiator Performance

**Flow:**
1. User selects "Radiator Performance"
2. App: "Capture each radiator with thermal camera"
3. User scans each rad
4. App measures top vs bottom temperature
5. Flags sludge if bottom significantly colder

**Data Written:**
```typescript
{
  centralHeating: {
    waterQuality: {
      suspectedSludgeFromThermal: [
        {
          radiatorId: "rad_bedroom_2",
          topTemp: 62, // °C
          bottomTemp: 38, // °C
          deltaT: -24, // Indicates sludge blockage
          recommendation: "Power flush required",
          captureId: "thermal_456"
        }
      ]
    }
  }
}
```

---

### 5.4 Google Earth / Maps Module

**Purpose:** Capture site context, roof geometry, access logistics.

**API:** Google Maps API (Static Maps, Elevation API, potentially Earth Engine)

**Modes:**

#### Mode: Site Overview & Roof

**Flow:**
1. User enters property postcode (or auto-detects from lead)
2. App loads satellite imagery
3. User traces roof facets on map
4. For each facet:
   - User sets orientation (N/S/E/W slider)
   - User sets pitch (slider with visual guide)
   - App calculates area
5. User marks obstacles (trees, chimneys)
6. Saves to `solarPv.roofUse.remoteRoofGeometry`

**Technical:**
```typescript
// /visual/maps/RoofGeometryMode.tsx
async function captureRoofGeometry(postcode: string) {
  const coords = await geocode(postcode);
  const satellite = await GoogleMaps.getStaticMap({
    center: coords,
    zoom: 20,
    mapType: 'satellite',
    size: '1024x1024'
  });

  // User draws polygons on map
  const facets = await collectFacetPolygons(satellite);

  // For each facet, get azimuth and pitch
  for (const facet of facets) {
    facet.azimuth = await promptAzimuth(facet);
    facet.pitch = await promptPitch(facet);
    facet.area = calculateArea(facet.outline); // m²
  }

  await siteContextService.saveRoofGeometry(sessionId, { coords, facets });
}
```

**Data Written:**
```typescript
{
  solarPv: {
    roofUse: {
      remoteRoofGeometry: {
        capturedFrom: "google_maps_satellite",
        capturedAt: "2025-12-05T14:30:00Z",
        facets: [
          {
            id: "roof_south",
            outline: [[lat, lng], ...],
            azimuth: 180, // due south
            pitch: 35, // degrees
            area: 28.5, // m²
            shading: "none",
            suitability: "excellent"
          },
          {
            id: "roof_north",
            outline: [[lat, lng], ...],
            azimuth: 0,
            pitch: 35,
            area: 28.5,
            shading: "partial", // tree shadow
            suitability: "poor"
          }
        ],
        obstacles: [
          {
            type: "tree",
            location: [lat, lng],
            height: 12, // m (estimated)
            notes: "Casts shadow on north roof 10am-2pm"
          }
        ]
      }
    }
  }
}
```

---

### 5.5 Bluetooth Laser Module

**Purpose:** Zero-friction linear measurements via BLE laser measure.

**Supported Devices:**
- Bosch GLM series (GLM 50 C, GLM 120 C)
- Leica DISTO series (D2, D510, D810)
- Generic BLE lasers with standard profile

**Flow:**
1. User pairs laser via Bluetooth settings
2. In survey, user selects context: "Room Width", "Rad Width", "Cable Run Segment", etc.
3. User aims laser and presses button
4. App listens for BLE notification → receives measurement
5. Auto-fills field in spec

**Technical:**
```typescript
// /visual/laser/BluetoothLaserService.ts
async function listenForMeasurement(context: string): Promise<number> {
  const laser = await BluetoothLE.connect(KNOWN_LASER_UUID);

  return new Promise((resolve) => {
    laser.onNotification((data) => {
      const distanceMm = parseDistanceFromBLE(data);
      resolve(distanceMm);
    });
  });
}

// Usage in room measurement screen
const width = await laserService.listenForMeasurement('room_width');
// User sees: "Measuring..." → "5240 mm" → auto-fills
```

**Data Targets:**
- `homeProfile.rooms[].dimensions`
- `centralHeating.emitters.radiators[].dimensions`
- `ev.parking.cableRouteSegments[]`
- `centralHeating.flueClearances.measuredDistances`

---

## 6. Travel Logging System

### 6.1 Purpose

Automatically track travel to/from survey sites for:
- Mileage expense claims
- HMRC compliance
- Route optimization
- Time tracking

### 6.2 Modes

#### Mode: Automatic Trip Tracking

**Flow:**
1. User starts survey session → app offers "Start Travel Log"
2. User taps "Start" when leaving office/home
3. App records GPS track (low frequency: 1 point/minute)
4. When user arrives on-site and opens survey → app detects arrival
5. Auto-stops tracking, calculates distance/duration
6. Saves `TravelLogEntry` linked to session

**Technical:**
```typescript
// /visual/travel/TravelLogger.ts
async function startTripTracking(sessionId: string) {
  const startLocation = await GPS.getCurrentPosition();
  const startPostcode = await reverseGeocode(startLocation);

  const tripId = uuid();
  const tracker = GPS.startBackgroundTracking({
    distanceFilter: 100, // meters
    timeInterval: 60000, // 1 minute
  });

  // Store in local state
  activeTripTracker.set(tripId, {
    sessionId,
    startTime: new Date(),
    startLocation,
    startPostcode,
    tracker,
    route: [],
  });
}

async function stopTripTracking(sessionId: string) {
  const trip = activeTripTracker.get(sessionId);
  if (!trip) return;

  const endLocation = await GPS.getCurrentPosition();
  const endPostcode = await reverseGeocode(endLocation);

  trip.tracker.stop();

  const distance = calculateRouteDistance(trip.route);
  const duration = (Date.now() - trip.startTime.getTime()) / 60000; // minutes

  const entry: TravelLogEntry = {
    id: uuid(),
    sessionId,
    leadId: getLeadIdForSession(sessionId),
    startTime: trip.startTime,
    endTime: new Date(),
    distanceKm: distance,
    durationMinutes: duration,
    startPostcode: trip.startPostcode,
    endPostcode,
    route: trip.route,
    purpose: 'site_visit',
    businessPortion: 1.0,
    mileageRate: getUserMileageRate(), // From settings
    calculatedCost: distance * getUserMileageRate(),
    createdBy: getCurrentUserId(),
  };

  await travelLogService.saveEntry(entry);
  activeTripTracker.delete(sessionId);
}
```

#### Mode: Manual Trip Entry

**For when automatic tracking wasn't used:**

**Form:**
- Date
- Start postcode
- End postcode
- Distance (km) - can calculate from postcodes
- Purpose dropdown
- Notes

### 6.3 Expense Export

**UI: Travel & Expenses Tab**

**Features:**
- Filter by date range
- Group by month
- Show total mileage and cost
- Export formats:
  - CSV (for spreadsheet)
  - PDF (for submission)
  - JSON (for accounting software API)

**CSV Format:**
```csv
Date,Lead ID,From,To,Distance (km),Duration (min),Rate (£/km),Cost (£),Purpose,Notes
2025-12-05,lead_5038xxxx,SW1A 1AA,SW1A 2AA,12.4,35,0.45,5.58,Site Visit,First survey
```

**PDF Format:**
- Company header
- Date range
- Line items with map thumbnails
- Total mileage and cost
- Signature line

### 6.4 HMRC Compliance

**Business Mileage Rules (UK):**
- Must record: date, from/to, miles, purpose
- Rate: £0.45/mile first 10k, £0.25/mile thereafter
- Mixed trips: only claim business portion

**Implementation:**
```typescript
interface TravelLogSettings {
  mileageRate: number;        // £/km
  threshold10k: number;       // km equivalent of 10k miles
  rateAboveThreshold: number; // £/km after threshold
  financialYearStart: string; // "2025-04-06"
}

function calculateAnnualCost(entries: TravelLogEntry[], settings: TravelLogSettings): number {
  const sorted = entries.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  let total = 0;
  let cumulative = 0;

  for (const entry of sorted) {
    const distance = entry.distanceKm * entry.businessPortion;
    if (cumulative < settings.threshold10k) {
      const atHighRate = Math.min(distance, settings.threshold10k - cumulative);
      const atLowRate = distance - atHighRate;
      total += atHighRate * settings.mileageRate;
      total += atLowRate * settings.rateAboveThreshold;
    } else {
      total += distance * settings.rateAboveThreshold;
    }
    cumulative += distance;
  }

  return total;
}
```

---

## 7. New Upgrade Modules

### 7.1 Air-to-Air Heat Pump / AC Module

**Module ID:** `airToAirHp`

**Purpose:** Survey and specify ductless mini-split or ducted air-to-air systems for heating/cooling.

**Data Structure:**
```typescript
interface AirToAirHpModule {
  // Indoor units
  indoorUnits: IndoorUnit[];

  // Outdoor unit
  outdoorUnit: OutdoorUnit;

  // Performance & sizing
  coolingDemand: CoolingDemand;
  heatingDemand?: HeatingDemand; // If using for heating

  // Installation
  condensateRoutes: CondensateRoute[];
  refrigerantLines: RefrigerantLine[];
  electricalSupply: ElectricalSupply;

  // Existing system (if any)
  existing?: {
    units: ExistingACUnit[];
    performanceIssues: ThermalCapture[]; // From IR inspection
  };
}

interface IndoorUnit {
  id: string;
  roomId: string;
  type: 'wall_mounted' | 'ceiling_cassette' | 'ducted' | 'floor_standing';
  position: {
    wall: 'north' | 'south' | 'east' | 'west';
    heightFromFloor: number; // mm
    captureId?: string; // If measured with ArUco
  };
  capacity: number; // BTU or kW
  notes?: string;
}

interface CoolingDemand {
  peakSolarGain: number; // W (from window area + orientation)
  internalGains: number; // W (occupants, appliances)
  totalLoad: number; // W
  recommendedCapacity: number; // kW
  calculationMethod: 'simple' | 'detailed_heat_gain';
}
```

**Survey Questions:**
- "Any existing AC or air-to-air heat pump?"
- "Which rooms need cooling in summer?"
- "Any rooms with large west/south-facing windows?"
- "Good outdoor spot for AC unit? (away from bedrooms)"
- "Where can condensate drain to?"

**Visual Captures:**
- **ArUco Mode: Indoor Unit Position** - Mark wall + height for unit placement
- **Thermal Mode: Hot Spot Detection** - Find rooms with high solar gain
- **Photo Mode: Outdoor Unit Location** - Photo of proposed outdoor unit site

**Upgrade Recommendations:**
- If property has hot west-facing rooms → flag AC as high-value
- If planning ASHP later → suggest controls integration
- If multiple rooms need cooling → ductless mini-split multi-zone

---

### 7.2 Glazing Module

**Module ID:** `glazing`

**Purpose:** Survey window quality, identify draught issues, recommend upgrades.

**Data Structure:**
```typescript
interface GlazingModule {
  windows: Window[];
  doors: Door[];

  // Performance
  overallUValue: number; // W/m²K (estimated)
  draughtIssues: DraughtIssue[];

  // Upgrade opportunities
  recommendations: GlazingRecommendation[];
}

interface Window {
  id: string;
  roomId: string;
  location: string; // "North wall, living room"

  // Dimensions
  width: number; // mm
  height: number; // mm
  area: number; // m²
  captureId?: string; // ArUco or laser measurement

  // Type
  glazing: 'single' | 'double' | 'triple' | 'secondary';
  frameType: 'timber' | 'upvc' | 'aluminium' | 'steel';
  openingType: 'casement' | 'sash' | 'tilt_turn' | 'fixed';

  // Condition
  age?: number; // years (estimated)
  condition: 'good' | 'fair' | 'poor';
  issues: string[]; // ["draughty", "condensation", "rot"]

  // Thermal data
  thermalCapture?: string; // ThermalCapture ID
  estimatedUValue: number; // W/m²K
}

interface DraughtIssue {
  windowId: string;
  severity: 'low' | 'medium' | 'high';
  location: string; // "Bottom left corner"
  thermalEvidence?: string; // ThermalCapture ID showing cold air
  notes: string;
}

interface GlazingRecommendation {
  windowId: string;
  recommendation: 'replace_double' | 'replace_triple' | 'secondary_glazing' | 'draught_proof';
  priority: 'high' | 'medium' | 'low';
  estimatedCost: number; // £
  annualSaving: number; // £/year
  paybackYears: number;
  rationale: string;
}
```

**Survey Questions:**
- "What type of windows? (single/double glazing)"
- "Frame material? (wood/uPVC/aluminium)"
- "Any draughty windows or condensation issues?"
- "When were windows last replaced?"

**Visual Captures:**
- **ArUco Mode: Window Dimensions** (5-marker pattern around opening)
- **Thermal Mode: Draught Detection** (IR showing cold air ingress)
- **Photo Mode: Window Condition** (close-ups of frames, seals)

**Upgrade Logic:**
- Single glazed + poor frames → "Replace with double/triple glazing" (high priority)
- Double glazed but draughty → "Draught-proof or replace seals" (medium)
- Good double glazed → "Consider secondary glazing for noise" (low)
- If ASHP planned + old glazing → "Upgrade glazing first" (prerequisite)

---

### 7.3 Insulation Module

**Module ID:** `insulation`

**Purpose:** Survey loft and cavity wall insulation, identify improvements.

**Data Structure:**
```typescript
interface InsulationModule {
  loft: LoftInsulation;
  cavity: CavityInsulation;
  solidWall?: SolidWallInsulation; // Future
  floor?: FloorInsulation; // Future
}

interface LoftInsulation {
  // Access
  access: 'hatch' | 'room' | 'none';
  accessQuality: 'easy' | 'restricted' | 'difficult';
  accessLocation: string;

  // Current state
  currentDepth: number; // mm (estimated or measured)
  coverage: 'full' | 'partial' | 'none';
  material: 'mineral_wool' | 'fiberglass' | 'cellulose' | 'unknown';

  // Geometry
  floorArea?: number; // m² (from LiDAR scan or manual)
  geometry?: {
    captureId: string; // LiDAR scan ID
    roofPitch: number;
    eaveHeight: number;
  };

  // Issues
  storageBoardingOver: boolean; // Boarding reduces insulation effectiveness
  dampIssues: boolean;
  thermalAnomalies: ThermalCapture[]; // IR showing heat escaping

  // Recommendations
  recommendedDepth: number; // mm (270-300mm typical)
  estimatedCost: number; // £
  annualSaving: number; // £/year
}

interface CavityInsulation {
  // Wall type
  wallType: 'cavity' | 'solid' | 'unknown';
  cavityWidth?: number; // mm (if known)

  // Current state
  filled: boolean | 'unknown';
  fillMaterial?: 'mineral_wool' | 'polystyrene_beads' | 'foam' | 'unknown';
  fillDate?: Date; // If known from records

  // Evidence
  drillMarks: boolean; // Visual evidence of retrofit
  thermalEvidence: ThermalCapture[]; // IR showing cold patches
  wallIssues: WallIssue[];

  // Suitability
  suitableForRetrofit: boolean;
  reasons: string[]; // ["Exposed to driving rain", "Cavity ties visible"]

  // Recommendations
  recommendFill: boolean;
  estimatedCost: number; // £
  annualSaving: number; // £/year
}

interface WallIssue {
  location: string; // "North wall, bedroom"
  type: 'cold_patch' | 'damp' | 'missing_insulation';
  severity: 'low' | 'medium' | 'high';
  thermalCapture?: string; // ThermalCapture ID
  notes: string;
}
```

**Survey Questions:**
- "How much loft insulation is there? (rough depth)"
- "Is the loft boarded for storage?"
- "Do you know if cavity walls are filled?"
- "Any cold walls or damp patches?"

**Visual Captures:**
- **LiDAR Mode: Loft Geometry** - Full 3D scan of loft space
- **Thermal Mode: Wall Inspection** - IR scan of all exterior walls
- **Photo Mode: Loft Access** - Photos showing current insulation depth

**Upgrade Logic:**
- Loft < 270mm → "Top up loft insulation" (quick win, high priority)
- Cavity unfilled + suitable → "Cavity wall insulation" (medium priority)
- If ASHP planned + poor insulation → "Insulate first" (prerequisite)
- Thermal anomalies detected → Detailed investigation recommended

---

## 8. Implementation Phases

### Phase 1: Foundation (Months 1-2)

**Goal:** Core visual infrastructure + one working sensor mode.

**Deliverables:**
- [ ] Device capability detection system
- [ ] Module registry and mode switching UI
- [ ] Geometry service (save/load geometric data)
- [ ] Session continuity (share session between voice + visual)
- [ ] **One complete mode:** ArUco Boiler Wall Calibration
  - 4-marker detection
  - Wall plane computation
  - Tap-to-annotate UI
  - Save to `centralHeating.geometry.boilerWallPlane`

**Tech Stack:**
- React Native (cross-platform)
- `react-native-vision-camera` for camera access
- `opencv-react-native` for ArUco detection
- Shared Hail Mary API for data persistence

**Success Criteria:**
- User can measure boiler wall clearances without LiDAR
- Data visible in main Hail Mary spec view

---

### Phase 2: Core Sensor Modes (Months 3-5)

**Goal:** All primary measurement modes working.

**Deliverables:**
- [ ] **LiDAR Module:**
  - Room scan mode (basic)
  - Save to `homeProfile.rooms[]`
- [ ] **ArUco Module:**
  - Radiator measurement mode
  - Window measurement mode
  - EV charger wall mode
- [ ] **Bluetooth Laser Module:**
  - Device pairing flow
  - Auto-fill measurements in any context
- [ ] **Maps Module:**
  - Roof geometry tracing (basic)
  - Save to `solarPv.roofUse.remoteRoofGeometry`

**Success Criteria:**
- User can complete a survey using visual modes for 80% of measurements
- No manual tape measure needed for radiators, rooms, clearances

---

### Phase 3: Advanced Inspection (Months 6-8)

**Goal:** Thermal inspection + site context.

**Deliverables:**
- [ ] **Thermal Module:**
  - FLIR One / Seek Thermal integration
  - Wall insulation check mode
  - Radiator performance mode
  - Save to `insulation.cavity.wallIssues[]` and `centralHeating.waterQuality`
- [ ] **Maps Module:**
  - Access & logistics marking
  - Obstacle detection
  - Save to `hazards.accessRestrictions`
- [ ] **Travel Logger:**
  - Automatic trip tracking
  - Manual entry
  - Basic CSV export

**Success Criteria:**
- User can detect insulation issues with thermal camera
- User can log travel automatically for expense claims

---

### Phase 4: Full Ecosystem (Months 9-12)

**Goal:** Complete integration + new upgrade modules.

**Deliverables:**
- [ ] **New Modules:**
  - Air-to-air HP/AC survey and recommendations
  - Glazing survey and upgrade logic
  - Insulation survey (loft + cavity)
- [ ] **Upgrade Engine Integration:**
  - Visual data feeds into roadmap generation
  - Multi-year planning (0-2 / 2-5 / 5-15 years)
  - Prerequisite detection (e.g., "Insulate before HP")
- [ ] **Travel & Expenses:**
  - PDF export with maps
  - HMRC compliance features
  - Accounting software API export
- [ ] **Advanced LiDAR:**
  - Object detection (rads, windows, boiler)
  - Auto-annotation of detected objects
  - 3D export (for architects/planners)

**Success Criteria:**
- Complete property survey (voice + visual) in 60-90 minutes
- Generates 15-year roadmap with geometry, thermal, and cost data
- Travel expenses ready for accountant with zero manual entry

---

## 9. Technical Stack

### 9.1 Mobile App

**Framework:** React Native (Expo managed workflow)

**Key Libraries:**
- `react-native-vision-camera` - Camera access, frame processing
- `opencv-react-native` - ArUco detection, image processing
- `@react-three/fiber` (React Native) - 3D visualization of LiDAR data
- `react-native-ble-plx` - Bluetooth Low Energy for laser measures
- `react-native-maps` - Map display for roof/site context
- `expo-location` - GPS tracking for travel logs
- `react-native-fs` - File system for caching point clouds
- `react-native-share` - Export travel logs as PDF/CSV

**ARKit/ARCore:**
- iOS: Native ARKit bindings via `react-native-arkit`
- Android: Native ARCore via `react-native-arcore`

### 9.2 Backend Extensions

**New API Endpoints:**
```
POST   /api/visual/geometry-captures
GET    /api/visual/geometry-captures?sessionId=xxx

POST   /api/visual/thermal-captures
GET    /api/visual/thermal-captures?sessionId=xxx

POST   /api/visual/site-context
GET    /api/visual/site-context?sessionId=xxx

POST   /api/travel-log/entries
GET    /api/travel-log/entries?dateRange=xxx
GET    /api/travel-log/export?format=csv|pdf
```

**Database Schema:**
```sql
CREATE TABLE geometry_captures (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES visit_sessions(id),
  mode VARCHAR(50),
  sensor VARCHAR(20),
  data JSONB,  -- Planes, dimensions, markers, etc.
  photo_url TEXT,
  created_at TIMESTAMP
);

CREATE TABLE thermal_captures (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES visit_sessions(id),
  mode VARCHAR(50),
  thermal_image_url TEXT,
  visible_image_url TEXT,
  annotations JSONB,
  created_at TIMESTAMP
);

CREATE TABLE travel_log_entries (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES visit_sessions(id),
  lead_id UUID REFERENCES leads(id),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  distance_km NUMERIC,
  duration_minutes INTEGER,
  start_postcode VARCHAR(10),
  end_postcode VARCHAR(10),
  route JSONB,
  purpose VARCHAR(50),
  business_portion NUMERIC,
  mileage_rate NUMERIC,
  calculated_cost NUMERIC,
  exported_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP
);
```

### 9.3 File Storage

**S3 Buckets:**
- `hailmary-geometry/` - Point clouds (compressed .ply files)
- `hailmary-thermal/` - Thermal images (FLIR format + PNG exports)
- `hailmary-photos/` - Reference photos with annotations
- `hailmary-maps/` - Satellite imagery + annotated maps

**Compression:**
- LiDAR point clouds: Draco compression (90% size reduction)
- Thermal images: JPEG with metadata sidecar
- Photos: WebP format (smaller than JPEG)

---

## 10. Security & Privacy

### 10.1 Data Sensitivity

**Low Risk:**
- Room dimensions
- Radiator sizes
- Generic site photos

**Medium Risk:**
- Thermal images (could reveal internal layout)
- GPS routes (reveal home/office addresses)
- Roof imagery (could aid burglary planning)

**High Risk:**
- Travel logs (personal movement patterns)
- Detailed floor plans (security risk)

### 10.2 Mitigations

**Data Minimization:**
- LiDAR: Store processed planes/dimensions, not full point clouds (unless user opts in)
- GPS: Coarse location (postcode level) for travel logs, detailed route optional
- Thermal: Blur backgrounds, focus on inspection areas

**Access Control:**
- Geometry/thermal data: Linked to session → only accessible by session owner
- Travel logs: Only visible to creating user (not shared with customers)
- Maps/satellite: Public data, but annotations are private

**Encryption:**
- At rest: S3 server-side encryption (AES-256)
- In transit: HTTPS/TLS 1.3
- Point clouds: Encrypted before upload

**Retention:**
- Geometry captures: 7 years (in line with quote retention)
- Thermal images: 2 years (or until job complete)
- Travel logs: 7 years (HMRC requirement)

**GDPR Compliance:**
- User consent for GPS tracking (opt-in)
- Right to deletion (cascade delete geometry/thermal for a property)
- Data portability (export as JSON/CSV)

---

## Appendices

### A. ArUco Marker Print Sheet

```
┌─────────────────────────────────────────────────────────┐
│     Hail Mary Visual Surveyor - ArUco Marker Sheet      │
│                                                           │
│  Print this page at 100% scale (no fit-to-page)         │
│  Use thick matte paper for best detection                │
│  Laminate for reusability                                │
│                                                           │
│  [0]  50mm ──►  [1]  50mm ──►  [2]  50mm ──►  [3]       │
│   ■               ■               ■               ■       │
│  500mm spacing between marker centers                    │
│                                                           │
│  [4]  50mm ──►  [5]  50mm ──►  [6]  50mm ──►  [7]       │
│   ■               ■               ■               ■       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Patterns:**
- **2-marker:** 0, 1 (500mm apart)
- **4-marker:** 0, 1, 2, 3 (1000mm × 1000mm square)
- **5-marker:** 0, 1, 2, 3, 4 (custom window pattern)
- **6-marker:** 0, 1, 2, 3, 4, 5 (floor + two walls)

### B. Bluetooth Laser Device List

**Confirmed Compatible:**
- Bosch GLM 50 C Professional
- Bosch GLM 100 C Professional
- Bosch GLM 120 C Professional
- Leica DISTO D2
- Leica DISTO D510
- Leica DISTO D810 touch
- Stanley TLM330 (limited features)

**BLE Service UUIDs:**
- Bosch: `00005301-0000-0041-5253-534f46540000`
- Leica: `3ab10100-f831-4395-b29d-570977d5bf94`

### C. Thermal Camera Compatibility

**Plug-in Devices:**
- FLIR One Pro (Lightning / USB-C)
- FLIR One Pro LT
- Seek Thermal Compact
- Seek Thermal CompactXR

**Import from External Apps:**
- FLIR Tools (export as radiometric JPEG)
- Seek Thermal app (export as PNG with temp metadata)

### D. Glossary

- **ArUco**: Augmented reality marker system for camera calibration
- **LiDAR**: Light Detection and Ranging (3D scanning with lasers)
- **IR**: Infrared (thermal imaging)
- **BLE**: Bluetooth Low Energy
- **Point cloud**: Collection of 3D points representing a scanned surface
- **Plane**: Flat surface (wall, floor, ceiling) detected from point cloud
- **Delta-T**: Temperature difference (e.g., supply vs return on heat pump)
- **Facet**: One section of a roof (e.g., south-facing slope)
- **Azimuth**: Compass direction (0° = North, 90° = East, 180° = South, 270° = West)

---

**End of Document**

*This is a living architecture document. Update as implementation progresses.*

*For questions or clarifications, reference this doc in commit messages and PRs.*

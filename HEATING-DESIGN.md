# Heating Design System

Comprehensive heating system design application integrated into the Hail-Mary monorepo.

## Overview

This system automates the design of heating systems for residential properties, from floor plan import through radiator selection and pipe routing.

## Features

### Completed ✅

1. **Database Schema**
   - Projects, floor plans, building data
   - Rooms with geometry data
   - Heat loss results per room
   - Radiator catalog and selections
   - Pipe network storage

2. **Core Calculation Engine** (`packages/heating-engine`)
   - Physics-based heat loss calculations (EN 12831)
   - Comprehensive U-value database for UK construction
   - Room-by-room heat loss breakdown
   - Validation and sanity checks

3. **Radiator Selection Algorithm**
   - Automated radiator sizing
   - Smart positioning (under windows, on external walls)
   - Wall space conflict detection
   - Multi-criteria scoring (size, cost, efficiency)

4. **API Endpoints** (`packages/api/src/routes/heating-design.ts`)
   - Project management (CRUD)
   - Building data entry
   - Heat loss calculation
   - Radiator catalog access
   - U-value reference data

5. **Build Integration**
   - Added to monorepo build scripts
   - TypeScript compilation
   - Package dependencies

### In Progress 🚧

1. **Type System Refinement**
   - Resolving conflicts with existing heat-loss-survey types
   - Namespace prefixing for clarity

2. **Floor Plan Import**
   - magicplan format parsing (USDZ, OBJ, PDF, JSON)
   - Room geometry extraction
   - Wall/window/door detection

3. **Pipe Routing**
   - Navigation mesh generation
   - A* pathfinding in 3D
   - Pipe sizing based on heat load
   - Material schedule generation

4. **Frontend Components**
   - Project dashboard
   - Floor plan viewer
   - Heat loss results table
   - Radiator placement UI
   - Pipe routing visualization

## Architecture

```
heating-design-system/
├── packages/
│   ├── heating-engine/          # Core calculation engine
│   │   ├── src/
│   │   │   ├── heatloss/        # Heat loss calculator
│   │   │   ├── radiators/       # Radiator selection
│   │   │   ├── routing/         # Pipe routing (planned)
│   │   │   └── import/          # Floor plan import (planned)
│   │   └── package.json
│   │
│   ├── shared/
│   │   └── src/heating-design/  # Shared types
│   │       ├── types.ts         # Core types
│   │       ├── uvalues.ts       # U-value database
│   │       └── index.ts
│   │
│   └── api/
│       ├── src/
│       │   ├── db/drizzle-schema.ts  # Database tables
│       │   └── routes/heating-design.ts  # API endpoints
│       └── package.json
```

## Database Schema

### Tables

- `heating_projects` - Design projects
- `heating_floor_plans` - Imported floor plans
- `heating_building_data` - Construction details
- `heating_rooms` - Room geometry
- `heating_heat_loss_results` - Calculated heat loss
- `heating_radiator_catalog` - Available radiators
- `heating_radiator_selections` - Selected radiators
- `heating_pipe_networks` - Pipe routing

## API Endpoints

### Projects
- `GET /api/heating-design/projects` - List projects
- `POST /api/heating-design/projects` - Create project
- `GET /api/heating-design/projects/:id` - Get project details
- `PUT /api/heating-design/projects/:id` - Update project
- `DELETE /api/heating-design/projects/:id` - Delete project

### Building Data
- `POST /api/heating-design/projects/:id/building-data` - Set construction details

### Heat Loss
- `POST /api/heating-design/projects/:id/calculate-heat-loss` - Run calculations
- `GET /api/heating-design/projects/:id/heat-loss` - Get results

### Reference Data
- `GET /api/heating-design/radiators/catalog` - Radiator database
- `GET /api/heating-design/uvalues` - U-value tables

## Usage Example

```typescript
// 1. Create a project
const project = await fetch('/api/heating-design/projects', {
  method: 'POST',
  body: JSON.stringify({ name: 'Smith Residence' })
});

// 2. Add building data
await fetch(`/api/heating-design/projects/${project.id}/building-data`, {
  method: 'POST',
  body: JSON.stringify({
    address: '123 High Street',
    postcode: 'SW1A 1AA',
    wallConstruction: 'cavity_full_fill',
    roofConstruction: 'loft_insulation_270mm',
    floorConstruction: 'solid_insulated',
    airChangesPerHour: 1.0,
  })
});

// 3. Calculate heat loss
const heatLoss = await fetch(
  `/api/heating-design/projects/${project.id}/calculate-heat-loss`,
  { method: 'POST' }
);

// 4. Review results
console.log(`Total heat load: ${heatLoss.totalLoad}W`);
console.log(`Rooms: ${heatLoss.roomCount}`);
```

## Next Steps

1. **Fix Type Conflicts**
   - Resolve duplicate type definitions
   - Clean up HD-prefix naming
   - Build packages successfully

2. **Floor Plan Import**
   - Implement USDZ parser
   - Implement PDF data extraction
   - Room boundary detection

3. **Pipe Routing**
   - Navigation mesh builder
   - Pathfinding algorithm
   - Pipe sizing logic

4. **Frontend**
   - Project management UI
   - Floor plan visualization
   - Interactive radiator placement
   - Reports and exports

5. **Testing**
   - Unit tests for calculations
   - Integration tests for API
   - End-to-end workflow tests

## Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Frontend**: React PWA (TBD)
- **Calculations**: Pure TypeScript functions
- **File Processing**: Sharp, PDF-lib, Three.js (planned)

## References

- EN 12831: Energy performance of buildings - Heat load calculation
- MCS Heat Pump Calculator methodology
- BR 443: Conventions for U-value calculations
- magicplan file format documentation

## Contributing

This is an internal project for the Hail-Mary heating business platform.

## Status: Phase 1 Complete

Core calculation engine and database schema are implemented. Next phase focuses on floor plan import and pipe routing algorithms.

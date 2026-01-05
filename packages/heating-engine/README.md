# Heating Engine

Core calculation engine for heating system design.

## Features

- **Heat Loss Calculations**: Physics-based heat loss calculations following EN 12831 methodology
- **Radiator Selection**: Automated radiator sizing and positioning algorithms
- **Pipe Routing**: (In Progress) Intelligent pipe routing with cost optimization
- **Floor Plan Import**: (In Progress) Import and parse magicplan floor plans

## Modules

### Heat Loss Calculator (`heatloss/`)

Calculate room-by-room heat loss based on:
- Building construction (U-values for walls, windows, floors, roofs)
- Thermal bridging
- Air infiltration/ventilation
- Design temperatures

```typescript
import { calculateRoomHeatLoss } from '@hail-mary/heating-engine';

const result = calculateRoomHeatLoss({
  room,
  building,
  climate,
  designConditions,
});

console.log(`Total heat loss: ${result.totalLoss}W`);
console.log(`Required radiator output: ${result.requiredOutput}W`);
```

### Radiator Selector (`radiators/`)

Automatically select and position radiators based on:
- Room heat loss requirements
- Available wall space
- Window positions
- Radiator catalog data

```typescript
import { selectRadiator } from '@hail-mary/heating-engine';

const selection = selectRadiator(
  requiredOutput,
  room,
  flowTemperature,
  radiatorDatabase
);

if (selection) {
  console.log(`Selected: ${selection.radiator.manufacturer} ${selection.radiator.model}`);
  console.log(`Position: Wall ${selection.placement.wallId}`);
}
```

## U-Value Database

Includes comprehensive U-value data for UK building construction types:

- **Walls**: Solid brick, cavity (filled/unfilled), modern insulated
- **Roofs**: Pitched/flat with various insulation levels
- **Floors**: Solid, suspended timber, beam & block
- **Glazing**: Single, double, triple, low-E

## Usage

Install dependencies:

```bash
npm install
```

Build the package:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Integration

This package is used by:
- `@hail-mary/api` - API endpoints for heating design
- `@hail-mary/pwa` - Frontend UI for heating system design

## Status

- ✅ Heat loss calculation engine
- ✅ Radiator selection algorithm
- ✅ U-value database
- ✅ TypeScript types and interfaces
- 🚧 Pipe routing algorithm (planned)
- 🚧 Floor plan import (planned)
- 🚧 PDF export (planned)

## License

ISC

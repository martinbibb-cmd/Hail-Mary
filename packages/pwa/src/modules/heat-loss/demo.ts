/**
 * Demo Data for Heat Loss UI Development
 *
 * Sample rooms, walls, and emitters for testing the confidence-led interface
 */

import type { Room, Wall, Emitter } from '@hail-mary/shared';

/**
 * Sample rooms for a typical UK semi-detached house
 */
export const demoRooms: Room[] = [
  {
    room_id: 'living-room',
    name: 'Living Room',
    dimensions: {
      floor_area_m2: 20.5,
      volume_m3: 51.25,
      height_m: 2.5,
    },
    design_temp_c: 21,
  },
  {
    room_id: 'kitchen',
    name: 'Kitchen',
    dimensions: {
      floor_area_m2: 12.0,
      volume_m3: 30.0,
      height_m: 2.5,
    },
    design_temp_c: 21,
  },
  {
    room_id: 'bedroom-1',
    name: 'Master Bedroom',
    dimensions: {
      floor_area_m2: 15.0,
      volume_m3: 37.5,
      height_m: 2.5,
    },
    design_temp_c: 18,
  },
  {
    room_id: 'bedroom-2',
    name: 'Bedroom 2',
    dimensions: {
      floor_area_m2: 10.0,
      volume_m3: 25.0,
      height_m: 2.5,
    },
    design_temp_c: 18,
  },
  {
    room_id: 'bathroom',
    name: 'Bathroom',
    dimensions: {
      floor_area_m2: 5.0,
      volume_m3: 12.5,
      height_m: 2.5,
    },
    design_temp_c: 22,
  },
];

/**
 * Sample walls for the demo rooms
 */
export const demoWalls: Wall[] = [
  // Living Room walls
  {
    wall_id: 'living-wall-1',
    orientation: 'N',
    area_m2: 10.0,
    construction_type: 'cavity_filled',
    u_value_calculated: 0.3,
    surface_classification: 'EXTERNAL',
    source_type: 'LIDAR',
    confidence_score: 'high',
  },
  {
    wall_id: 'living-wall-2',
    orientation: 'W',
    area_m2: 8.2,
    construction_type: 'cavity_filled',
    u_value_calculated: 0.3,
    surface_classification: 'EXTERNAL',
    source_type: 'LIDAR',
    confidence_score: 'high',
  },
  {
    wall_id: 'living-wall-3',
    orientation: 'E',
    area_m2: 8.2,
    construction_type: 'solid',
    u_value_calculated: 1.7,
    surface_classification: 'PARTY_WALL',
    source_type: 'ASSUMED',
    confidence_score: 'medium',
  },

  // Kitchen walls
  {
    wall_id: 'kitchen-wall-1',
    orientation: 'N',
    area_m2: 6.0,
    construction_type: 'cavity_unfilled',
    u_value_calculated: 1.4,
    surface_classification: 'EXTERNAL',
    source_type: 'MANUAL',
    confidence_score: 'medium',
  },
  {
    wall_id: 'kitchen-wall-2',
    orientation: 'E',
    area_m2: 4.8,
    construction_type: 'solid',
    u_value_calculated: 1.7,
    surface_classification: 'UNHEATED_ADJACENT',
    source_type: 'ASSUMED',
    confidence_score: 'low',
  },

  // Master Bedroom walls
  {
    wall_id: 'bedroom1-wall-1',
    orientation: 'N',
    area_m2: 7.5,
    construction_type: 'cavity_unfilled',
    u_value_calculated: 1.4,
    surface_classification: 'EXTERNAL',
    source_type: 'ASSUMED',
    confidence_score: 'low',
  },
  {
    wall_id: 'bedroom1-wall-2',
    orientation: 'W',
    area_m2: 6.0,
    construction_type: 'cavity_unfilled',
    u_value_calculated: 1.4,
    surface_classification: 'EXTERNAL',
    source_type: 'ASSUMED',
    confidence_score: 'low',
  },

  // Bedroom 2 walls
  {
    wall_id: 'bedroom2-wall-1',
    orientation: 'S',
    area_m2: 5.0,
    construction_type: 'cavity_unfilled',
    u_value_calculated: 1.4,
    surface_classification: 'EXTERNAL',
    source_type: 'ASSUMED',
    confidence_score: 'low',
  },

  // Bathroom walls
  {
    wall_id: 'bathroom-wall-1',
    orientation: 'N',
    area_m2: 2.5,
    construction_type: 'cavity_filled',
    u_value_calculated: 0.3,
    surface_classification: 'EXTERNAL',
    source_type: 'MANUAL',
    confidence_score: 'medium',
  },
];

/**
 * Sample emitters (radiators) for adequacy checking
 */
export const demoEmitters: Emitter[] = [
  {
    emitter_id: 'living-rad-1',
    room_id: 'living-room',
    type: 'radiator',
    radiator_details: {
      panel_type: 'K2',
      height_mm: 600,
      width_mm: 1400,
      output_at_dt50: 2800,
    },
  },
  {
    emitter_id: 'kitchen-rad-1',
    room_id: 'kitchen',
    type: 'radiator',
    radiator_details: {
      panel_type: 'P+',
      height_mm: 600,
      width_mm: 1000,
      output_at_dt50: 1200,
    },
  },
  {
    emitter_id: 'bedroom1-rad-1',
    room_id: 'bedroom-1',
    type: 'radiator',
    radiator_details: {
      panel_type: 'K1',
      height_mm: 600,
      width_mm: 1200,
      output_at_dt50: 1800,
    },
  },
  {
    emitter_id: 'bedroom2-rad-1',
    room_id: 'bedroom-2',
    type: 'radiator',
    radiator_details: {
      panel_type: 'P+',
      height_mm: 600,
      width_mm: 800,
      output_at_dt50: 950,
    },
  },
  {
    emitter_id: 'bathroom-rad-1',
    room_id: 'bathroom',
    type: 'radiator',
    radiator_details: {
      panel_type: 'P+',
      height_mm: 800,
      width_mm: 500,
      output_at_dt50: 600,
    },
  },
];

/**
 * Load demo data into the heat loss store
 */
export function loadDemoData() {
  const { setRooms, setWalls, setEmitters, calculateHeatLoss } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./heatLossStore').useHeatLossStore.getState();

  setRooms(demoRooms);
  setWalls(demoWalls);
  setEmitters(demoEmitters);

  // Trigger calculation
  void calculateHeatLoss();

  console.log('✅ Demo data loaded!');
  console.log('Rooms:', demoRooms.length);
  console.log('Walls:', demoWalls.length);
  console.log('Emitters:', demoEmitters.length);
}

/**
 * Example usage in browser console:
 *
 * import { loadDemoData } from './modules/heat-loss/demo';
 * loadDemoData();
 */

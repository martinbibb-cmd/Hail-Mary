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
    room_name: 'Living Room',
    room_type: 'living_room',
    dimensions: {
      floor_area_m2: 20.5,
      volume_m3: 51.25,
      ceiling_height_m: 2.5,
      source_type: 'LIDAR',
      confidence_score: 'high',
    },
    desired_temp_c: 21,
  },
  {
    room_id: 'kitchen',
    room_name: 'Kitchen',
    room_type: 'kitchen',
    dimensions: {
      floor_area_m2: 12.0,
      volume_m3: 30.0,
      ceiling_height_m: 2.5,
      source_type: 'MANUAL',
      confidence_score: 'medium',
    },
    desired_temp_c: 21,
  },
  {
    room_id: 'bedroom-1',
    room_name: 'Master Bedroom',
    room_type: 'bedroom',
    dimensions: {
      floor_area_m2: 15.0,
      volume_m3: 37.5,
      ceiling_height_m: 2.5,
      source_type: 'ASSUMED',
      confidence_score: 'low',
    },
    desired_temp_c: 18,
  },
  {
    room_id: 'bedroom-2',
    room_name: 'Bedroom 2',
    room_type: 'bedroom',
    dimensions: {
      floor_area_m2: 10.0,
      volume_m3: 25.0,
      ceiling_height_m: 2.5,
      source_type: 'ASSUMED',
      confidence_score: 'low',
    },
    desired_temp_c: 18,
  },
  {
    room_id: 'bathroom',
    room_name: 'Bathroom',
    room_type: 'bathroom',
    dimensions: {
      floor_area_m2: 5.0,
      volume_m3: 12.5,
      ceiling_height_m: 2.5,
      source_type: 'MANUAL',
      confidence_score: 'medium',
    },
    desired_temp_c: 22,
  },
];

/**
 * Sample walls for the demo rooms
 */
export const demoWalls: Wall[] = [
  // Living Room walls
  {
    wall_id: 'living-wall-1',
    room_id: 'living-room',
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
    room_id: 'living-room',
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
    room_id: 'living-room',
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
    room_id: 'kitchen',
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
    room_id: 'kitchen',
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
    room_id: 'bedroom-1',
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
    room_id: 'bedroom-1',
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
    room_id: 'bedroom-2',
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
    room_id: 'bathroom',
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
    emitter_type: 'radiator',
    radiator_type: 'double_panel_double_convector',
    width_mm: 1400,
    height_mm: 600,
    length_mm: 1400,
    output_at_dt50_w: 2800,
  },
  {
    emitter_id: 'kitchen-rad-1',
    room_id: 'kitchen',
    emitter_type: 'radiator',
    radiator_type: 'single_panel',
    width_mm: 1000,
    height_mm: 600,
    length_mm: 1000,
    output_at_dt50_w: 1200,
  },
  {
    emitter_id: 'bedroom1-rad-1',
    room_id: 'bedroom-1',
    emitter_type: 'radiator',
    radiator_type: 'double_panel_single_convector',
    width_mm: 1200,
    height_mm: 600,
    length_mm: 1200,
    output_at_dt50_w: 1800,
  },
  {
    emitter_id: 'bedroom2-rad-1',
    room_id: 'bedroom-2',
    emitter_type: 'radiator',
    radiator_type: 'single_panel',
    width_mm: 800,
    height_mm: 600,
    length_mm: 800,
    output_at_dt50_w: 950,
  },
  {
    emitter_id: 'bathroom-rad-1',
    room_id: 'bathroom',
    emitter_type: 'radiator',
    radiator_type: 'towel_rail',
    width_mm: 500,
    height_mm: 800,
    length_mm: 500,
    output_at_dt50_w: 600,
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

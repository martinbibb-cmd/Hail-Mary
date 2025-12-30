/**
 * Heat Loss Store (v2)
 *
 * Zustand store with refined 3-layer confidence system
 */

import { create } from 'zustand';
import type {
  Room,
  Wall,
  Emitter,
  HeatLossCalculations,
  RoomHeatLoss,
  DesignConditions,
  ThermalBridgingConfig,
  AirtightnessConfig,
} from '@hail-mary/shared';
import type {
  FlowTemp,
  RoomSummary,
  HeatLossState,
  AdequacyAtAllTemps,
} from './types';
import {
  calculateRoomConfidence,
  calculateResultConfidence,
  getValidationState,
} from './confidence';

interface HeatLossStore extends HeatLossState {
  // Actions
  setRooms: (rooms: Room[]) => void;
  setWalls: (walls: Wall[]) => void;
  setEmitters: (emitters: Emitter[]) => void;
  setFlowTemp: (temp: FlowTemp) => void;
  selectRoom: (roomId: string | null) => void;
  calculateHeatLoss: () => Promise<void>;
  reset: () => void;
}

const initialState: HeatLossState = {
  rooms: [],
  walls: [],
  emitters: [],
  calculations: null,
  validationState: 'INCOMPLETE',
  selectedFlowTemp: 55, // Default to 55°C
  selectedRoomId: null,
  isCalculating: false,
  error: null,
  lastCalculatedAt: null,
  roomSummaries: [],
  wholeHouseConfidence: 0,
};

/**
 * Build adequacy at all temps from emitter adequacy result
 */
function buildAdequacyAtAllTemps(
  adequacy: any
): AdequacyAtAllTemps {
  return {
    at_45c: adequacy?.adequacy_at_45c || null,
    at_55c: adequacy?.adequacy_at_55c || null,
    at_75c: adequacy?.adequacy_at_75c || null,
  };
}

/**
 * Build room summaries from calculation results (v2)
 */
function buildRoomSummaries(
  rooms: Room[],
  walls: Wall[],
  calculations: HeatLossCalculations | null
): RoomSummary[] {
  if (!calculations || !calculations.room_heat_losses) {
    return [];
  }

  const wallsByRoom = walls.reduce((acc, wall) => {
    const roomId = (wall as any).room_id;
    if (!acc[roomId]) acc[roomId] = [];
    acc[roomId].push(wall);
    return acc;
  }, {} as Record<string, Wall[]>);

  return calculations.room_heat_losses.map((roomHeatLoss: RoomHeatLoss) => {
    const room = rooms.find((r) => r.room_id === roomHeatLoss.room_id);
    const roomWalls = wallsByRoom[roomHeatLoss.room_id] || [];

    if (!room) {
      // Fallback for missing room data
      return {
        room_id: roomHeatLoss.room_id,
        room_name: roomHeatLoss.room_id,
        heat_loss_w: roomHeatLoss.total_loss_w || 0,
        confidence_color: 'red' as const,
        confidence_score: 0,
        risk_flags: ['MISSING_EXTERNAL_WALLS' as const],
        adequacy_at_all_temps: buildAdequacyAtAllTemps(roomHeatLoss.emitter_adequacy),
      };
    }

    // v2 confidence calculation
    const confidence = calculateRoomConfidence(room, roomWalls);

    return {
      room_id: roomHeatLoss.room_id,
      room_name: room.name || roomHeatLoss.room_id,
      heat_loss_w: roomHeatLoss.total_loss_w || 0,
      confidence_color: confidence.color,
      confidence_score: confidence.score,
      risk_flags: confidence.riskFlags,
      adequacy_at_all_temps: buildAdequacyAtAllTemps(roomHeatLoss.emitter_adequacy),
    };
  });
}

export const useHeatLossStore = create<HeatLossStore>((set, get) => ({
  ...initialState,

  setRooms: (rooms) => {
    set({ rooms });
  },

  setWalls: (walls) => {
    set({ walls });
  },

  setEmitters: (emitters) => {
    set({ emitters });
  },

  setFlowTemp: (temp) => {
    // Instant toggle - no API call needed
    set({ selectedFlowTemp: temp });
  },

  selectRoom: (roomId) => {
    set({ selectedRoomId: roomId });
  },

  calculateHeatLoss: async () => {
    const state = get();

    if (state.rooms.length === 0) {
      set({ error: 'No rooms to calculate', validationState: 'INCOMPLETE' });
      return;
    }

    set({ isCalculating: true, error: null });

    try {
      // Build request body
      const requestBody = {
        rooms: state.rooms,
        walls: state.walls,
        emitters: state.emitters,
        designConditions: {
          design_external_temp_c: -3, // UK MCS standard
          desired_internal_temp_c: 21,
        } as DesignConditions,
        thermalBridgingConfig: {
          enabled: true,
          uplift_factor_percent: 10,
        } as ThermalBridgingConfig,
        airtightnessConfig: {
          source: 'age_band' as const,
          age_band: '1981-1990',
          n50_value: 10,
        } as AirtightnessConfig,
      };

      // Call API
      const response = await fetch('/api/atlas/calculate-heat-loss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate heat loss');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Calculation failed');
      }

      const calculations: HeatLossCalculations = result.data;

      // Build room summaries (v2)
      const roomSummaries = buildRoomSummaries(
        state.rooms,
        state.walls,
        calculations
      );

      // Calculate whole-house confidence (v2 - weighted by heat loss)
      const roomConfidences = new Map(
        roomSummaries.map((rs) => [rs.room_id, rs.confidence_score])
      );
      const wholeHouseConfidence = calculateResultConfidence(
        calculations.room_heat_losses || [],
        roomConfidences
      );

      // Determine validation state
      const validationState = getValidationState(
        state.rooms,
        state.walls,
        roomConfidences
      );

      set({
        calculations,
        roomSummaries,
        wholeHouseConfidence,
        validationState,
        lastCalculatedAt: new Date(),
        isCalculating: false,
        error: null,
      });
    } catch (error) {
      console.error('Error calculating heat loss:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isCalculating: false,
        validationState: 'INCOMPLETE',
      });
    }
  },

  reset: () => {
    set(initialState);
  },
}));

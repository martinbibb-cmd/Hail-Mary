/**
 * Heat Loss Store
 *
 * Zustand store for managing heat loss calculation state
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
import type { FlowTemp, RoomSummary, AdequacyStatus, HeatLossState } from './types';
import {
  calculateRoomConfidence,
  calculateWholeHouseConfidence,
} from './confidenceUtils';

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
  selectedFlowTemp: 55, // Default to 55°C
  selectedRoomId: null,
  isCalculating: false,
  error: null,
  lastCalculatedAt: null,
  roomSummaries: [],
  wholeHouseConfidence: 0,
};

/**
 * Get adequacy status from emitter adequacy result
 */
function getAdequacyStatus(adequate: boolean | undefined): AdequacyStatus {
  if (adequate === undefined) return 'unknown';
  return adequate ? 'ok' : 'upsize';
}

/**
 * Build room summaries from calculation results
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
        risk_icons: [],
        adequacy_45: 'unknown' as const,
        adequacy_55: 'unknown' as const,
        adequacy_75: 'unknown' as const,
      };
    }

    const confidence = calculateRoomConfidence(
      room,
      roomWalls,
      calculations.audit_trail || []
    );

    // Extract adequacy for different flow temps from emitter_adequacy
    const adequacy = roomHeatLoss.emitter_adequacy;
    const adequacy_45 = getAdequacyStatus(adequacy?.adequate_at_mwt_45);
    const adequacy_55 = getAdequacyStatus(adequacy?.adequate_at_mwt_55);
    const adequacy_75 = getAdequacyStatus(adequacy?.adequate_at_mwt_75);

    return {
      room_id: roomHeatLoss.room_id,
      room_name: room.name || roomHeatLoss.room_id,
      heat_loss_w: roomHeatLoss.total_loss_w || 0,
      confidence_color: confidence.color,
      confidence_score: confidence.score,
      risk_icons: confidence.riskIcons,
      adequacy_45,
      adequacy_55,
      adequacy_75,
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
    set({ selectedFlowTemp: temp });
  },

  selectRoom: (roomId) => {
    set({ selectedRoomId: roomId });
  },

  calculateHeatLoss: async () => {
    const state = get();

    if (state.rooms.length === 0) {
      set({ error: 'No rooms to calculate' });
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

      // Build room summaries
      const roomSummaries = buildRoomSummaries(
        state.rooms,
        state.walls,
        calculations
      );

      const wholeHouseConfidence = calculateWholeHouseConfidence(roomSummaries);

      set({
        calculations,
        roomSummaries,
        wholeHouseConfidence,
        lastCalculatedAt: new Date(),
        isCalculating: false,
        error: null,
      });
    } catch (error) {
      console.error('Error calculating heat loss:', error);
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        isCalculating: false,
      });
    }
  },

  reset: () => {
    set(initialState);
  },
}));

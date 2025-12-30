/**
 * Atlas Heat Loss API Routes
 * 
 * Room-by-room heat loss calculations following MCS 3005-D and BS EN 12831.
 * 
 * POST /api/atlas/calculate-heat-loss
 * body: {
 *   rooms: Room[],
 *   walls: Wall[],
 *   emitters?: Emitter[],
 *   designConditions?: DesignConditions,
 *   thermalBridgingConfig?: ThermalBridgingConfig,
 *   setbackRecoveryConfig?: SetbackRecoveryConfig,
 *   airtightnessConfig?: AirtightnessConfig
 * }
 * 
 * Returns:
 * - Room-by-room heat loss breakdown
 * - Total property kW requirement
 * - Emitter adequacy report for every room
 * - Full audit trail for 'Sarah' to translate into PDF
 */

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  calculatePropertyHeatLoss,
  Room,
  Wall,
  Emitter,
  DesignConditions,
  ThermalBridgingConfig,
  SetbackRecoveryConfig,
  AirtightnessConfig,
} from '@hail-mary/shared';

const router = Router();

interface CalculateHeatLossBody {
  rooms?: unknown;
  walls?: unknown;
  emitters?: unknown;
  designConditions?: unknown;
  thermalBridgingConfig?: unknown;
  setbackRecoveryConfig?: unknown;
  airtightnessConfig?: unknown;
}

/**
 * Type guards for validation
 */
function isValidRoom(room: unknown): room is Room {
  if (!room || typeof room !== 'object') return false;
  const r = room as any;
  return (
    typeof r.room_id === 'string' &&
    r.dimensions &&
    typeof r.dimensions === 'object' &&
    typeof r.dimensions.floor_area_m2 === 'number' &&
    typeof r.dimensions.volume_m3 === 'number'
  );
}

function isValidWall(wall: unknown): wall is Wall {
  if (!wall || typeof wall !== 'object') return false;
  const w = wall as any;
  return (
    typeof w.wall_id === 'string' &&
    typeof w.area_m2 === 'number'
  );
}

/**
 * Validate and parse input data
 */
function validateAndParseInput(body: CalculateHeatLossBody): {
  valid: boolean;
  error?: string;
  data?: {
    rooms: Room[];
    walls: Wall[];
    emitters: Emitter[];
    designConditions: DesignConditions;
    thermalBridgingConfig?: ThermalBridgingConfig;
    setbackRecoveryConfig?: SetbackRecoveryConfig;
    airtightnessConfig?: AirtightnessConfig;
  };
} {
  // Validate rooms
  if (!Array.isArray(body.rooms) || body.rooms.length === 0) {
    return { valid: false, error: 'rooms array is required and must not be empty' };
  }

  // Validate walls
  if (!Array.isArray(body.walls)) {
    return { valid: false, error: 'walls array is required' };
  }

  // Validate each room with type guard
  for (const room of body.rooms) {
    if (!isValidRoom(room)) {
      return { valid: false, error: 'Each room must have room_id and dimensions (floor_area_m2, volume_m3)' };
    }
  }

  // Validate each wall with type guard
  for (const wall of body.walls) {
    if (!isValidWall(wall)) {
      return { valid: false, error: 'Each wall must have wall_id and area_m2' };
    }
    // Check that wall has room_id for proper grouping
    const w = wall as any;
    if (!w.room_id || typeof w.room_id !== 'string') {
      return { valid: false, error: 'Each wall must have a room_id to associate it with a room' };
    }
  }

  // Default design conditions
  const designConditions: DesignConditions = {
    design_external_temp_c: -3, // UK MCS standard
    desired_internal_temp_c: 21, // Standard living areas
    ...(body.designConditions && typeof body.designConditions === 'object' 
      ? body.designConditions 
      : {}),
  };

  // Parse emitters
  const emitters = Array.isArray(body.emitters) ? body.emitters as Emitter[] : [];

  return {
    valid: true,
    data: {
      rooms: body.rooms as Room[],
      walls: body.walls as Wall[],
      emitters,
      designConditions,
      thermalBridgingConfig: body.thermalBridgingConfig as ThermalBridgingConfig | undefined,
      setbackRecoveryConfig: body.setbackRecoveryConfig as SetbackRecoveryConfig | undefined,
      airtightnessConfig: body.airtightnessConfig as AirtightnessConfig | undefined,
    },
  };
}

/**
 * POST /api/atlas/calculate-heat-loss
 * 
 * Calculate room-by-room heat loss with emitter adequacy checking
 */
router.post('/calculate-heat-loss', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as CalculateHeatLossBody;

    // Validate input
    const validation = validateAndParseInput(body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const { rooms, walls, emitters, designConditions, thermalBridgingConfig, setbackRecoveryConfig, airtightnessConfig } = validation.data!;

    // Build wall and emitter maps by room
    const wallsByRoom = new Map<string, Wall[]>();
    const emittersByRoom = new Map<string, Emitter[]>();

    // Group walls by room (room_id is now required and validated)
    for (const wall of walls) {
      const roomId = (wall as any).room_id as string;
      if (!wallsByRoom.has(roomId)) {
        wallsByRoom.set(roomId, []);
      }
      wallsByRoom.get(roomId)!.push(wall);
    }

    // Group emitters by room
    for (const emitter of emitters) {
      const roomId = emitter.room_id;
      if (!emittersByRoom.has(roomId)) {
        emittersByRoom.set(roomId, []);
      }
      emittersByRoom.get(roomId)!.push(emitter);
    }

    // Calculate heat loss
    const result = calculatePropertyHeatLoss({
      rooms,
      wallsByRoom,
      emittersByRoom,
      designConditions,
      thermalBridgingConfig,
      setbackRecoveryConfig,
      airtightnessConfig,
    });

    // Return results
    return res.status(200).json({
      success: true,
      data: {
        calculation_method: result.calculation_method,
        design_conditions: result.design_conditions,
        thermal_bridging_config: result.thermal_bridging_config,
        setback_recovery_config: result.setback_recovery_config,
        airtightness_config: result.airtightness_config,
        room_heat_losses: result.room_heat_losses,
        whole_house_heat_loss_w: result.whole_house_heat_loss_w,
        whole_house_heat_loss_kw: result.whole_house_heat_loss_kw,
        heat_loss_per_m2: result.heat_loss_per_m2,
        safety_margin_percent: result.safety_margin_percent,
        recommended_boiler_size_kw: result.recommended_boiler_size_kw,
        audit_trail: result.audit_trail,
      },
    });
  } catch (error) {
    console.error('Error calculating heat loss:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/atlas/defaults
 * 
 * Get default configuration values for Atlas heat loss calculations
 */
router.get('/defaults', requireAuth, async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        design_conditions: {
          design_external_temp_c: -3, // UK MCS standard
          desired_internal_temp_c: 21, // Standard living areas
        },
        thermal_bridging: {
          default_uplift_percent: 10,
          note: 'Global uplift factor for MVP (not junction-by-junction psi-values)',
        },
        airtightness: {
          default_ach: 1.0, // Average UK dwelling
          n50_conversion_factor: 20, // Standard for normal exposure
          age_bands: {
            'pre-1919': 2.0,
            '1919-1944': 1.5,
            '1945-1964': 1.5,
            '1965-1980': 1.0,
            '1981-1990': 1.0,
            '1991-2002': 0.5,
            '2003-2010': 0.5,
            '2011+': 0.5,
          },
        },
        surface_classifications: [
          'EXTERNAL',
          'PARTY_WALL',
          'UNHEATED_ADJACENT',
          'GROUND_FLOOR',
        ],
        data_source_types: [
          'LIDAR',
          'MANUAL',
          'SATELLITE',
          'THERMAL_CAMERA',
          'BOROSCOPE',
          'ASSUMED',
          'TABLE_LOOKUP',
        ],
      },
    });
  } catch (error) {
    console.error('Error fetching defaults:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;

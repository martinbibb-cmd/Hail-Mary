/**
 * Tests for Atlas Heat Loss API
 * 
 * Focus on critical business logic:
 * 1. Party wall calculations (0 ΔT, not a discount)
 * 2. Thermal bridging uplift
 * 3. Emitter adequacy checking
 * 4. Audit trail generation
 */

import {
  calculateRoomHeatLoss,
  calculatePropertyHeatLoss,
  calculateEffectiveDeltaT,
  calculateEffectiveACH,
  createAuditEntry,
  ATLAS_DEFAULTS,
} from '../atlas-heat-loss';

import {
  Room,
  Wall,
  Emitter,
  DesignConditions,
  AuditTrailEntry,
} from '../../types/heat-loss-survey.types';

describe('Atlas Heat Loss API', () => {
  // Test data
  const designConditions: DesignConditions = {
    design_external_temp_c: -3,
    desired_internal_temp_c: 21,
  };

  const testRoom: Room = {
    room_id: 'room-1',
    name: 'Living Room',
    dimensions: {
      floor_area_m2: 20,
      volume_m3: 50,
    },
  };

  describe('Party Wall Logic - Critical Fix', () => {
    it('should calculate 0W heat loss for party walls (0 ΔT)', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const partyWallDeltaT = calculateEffectiveDeltaT(
        'PARTY_WALL',
        21, // internal
        -3, // external
        auditTrail
      );

      expect(partyWallDeltaT).toBe(0);
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[0].notes).toContain('ΔT = 0');
      expect(auditTrail[0].notes).toContain('heated adjacent');
    });

    it('should calculate full ΔT for external walls', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const externalDeltaT = calculateEffectiveDeltaT(
        'EXTERNAL',
        21, // internal
        -3, // external
        auditTrail
      );

      expect(externalDeltaT).toBe(24);
    });

    it('should calculate reduced ΔT for unheated adjacent spaces', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const unheatedDeltaT = calculateEffectiveDeltaT(
        'UNHEATED_ADJACENT',
        21, // internal
        -3, // external
        auditTrail
      );

      // Unheated space assumed 5°C warmer than outside: -3 + 5 = 2°C
      // ΔT = 21 - 2 = 19K
      expect(unheatedDeltaT).toBe(19);
      expect(auditTrail[0].notes).toContain('Unheated adjacent');
    });

    it('should calculate ground floor ΔT correctly', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const groundDeltaT = calculateEffectiveDeltaT(
        'GROUND_FLOOR',
        21, // internal
        -3, // external (not used for ground)
        auditTrail
      );

      // Ground temp assumed 10°C year-round
      // ΔT = 21 - 10 = 11K
      expect(groundDeltaT).toBe(11);
      expect(auditTrail[0].notes).toContain('ground temp');
    });

    it('should result in 0W loss for party wall in room calculation', () => {
      const partyWall: Wall = {
        wall_id: 'wall-party',
        orientation: 'E',
        area_m2: 10,
        u_value_calculated: 1.6, // Doesn't matter, ΔT=0
        surface_classification: 'PARTY_WALL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [partyWall],
        designConditions,
      });

      // Fabric loss should be 0W due to party wall
      expect(result.roomHeatLoss.fabric_loss_w).toBe(0);
      
      // But ventilation loss should still exist
      expect(result.roomHeatLoss.ventilation_loss_w).toBeGreaterThan(0);
      
      // Total should equal ventilation only (no fabric loss)
      expect(result.roomHeatLoss.total_loss_w).toBe(
        result.roomHeatLoss.ventilation_loss_w
      );
    });

    it('should prevent undersizing by not treating party wall as a discount', () => {
      // This is the key test: party wall should contribute 0W,
      // not reduce the total by a percentage

      const externalWall: Wall = {
        wall_id: 'wall-ext',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const partyWall: Wall = {
        wall_id: 'wall-party',
        orientation: 'E',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'PARTY_WALL',
      };

      const resultWithParty = calculateRoomHeatLoss({
        room: testRoom,
        walls: [externalWall, partyWall],
        designConditions,
      });

      const resultWithoutParty = calculateRoomHeatLoss({
        room: testRoom,
        walls: [externalWall],
        designConditions,
      });

      // Fabric loss should be identical (party wall adds 0W, not a discount)
      expect(resultWithParty.roomHeatLoss.fabric_loss_w).toBe(
        resultWithoutParty.roomHeatLoss.fabric_loss_w
      );
    });
  });

  describe('Thermal Bridging Uplift', () => {
    it('should not apply thermal bridging when disabled', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        thermalBridgingConfig: {
          enabled: false,
          uplift_factor_percent: 10,
        },
      });

      expect(result.roomHeatLoss.thermal_bridging_w).toBe(0);
    });

    it('should apply default 10% thermal bridging uplift when enabled', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        thermalBridgingConfig: {
          enabled: true,
          uplift_factor_percent: 10,
        },
      });

      const fabricLoss = result.roomHeatLoss.fabric_loss_w ?? 0;
      const expectedThermalBridging = Math.round(fabricLoss * 0.1);

      expect(result.roomHeatLoss.thermal_bridging_w).toBe(expectedThermalBridging);
    });

    it('should apply custom thermal bridging uplift', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        thermalBridgingConfig: {
          enabled: true,
          uplift_factor_percent: 15, // Custom 15%
        },
      });

      const fabricLoss = result.roomHeatLoss.fabric_loss_w ?? 0;
      const expectedThermalBridging = Math.round(fabricLoss * 0.15);

      expect(result.roomHeatLoss.thermal_bridging_w).toBe(expectedThermalBridging);
    });
  });

  describe('Emitter Adequacy - The Killer Feature', () => {
    it('should calculate radiator adequacy at different MWTs', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const radiator: Emitter = {
        emitter_id: 'rad-1',
        room_id: 'room-1',
        type: 'radiator',
        radiator_details: {
          panel_type: 'K2', // Double panel, double convector
          height_mm: 600,
          width_mm: 1000,
          depth_mm: 100,
        },
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        emitters: [radiator],
        designConditions,
      });

      expect(result.roomHeatLoss.emitter_adequacy).toBeDefined();
      
      const adequacy = result.roomHeatLoss.emitter_adequacy!;
      expect(adequacy.emitter_id).toBe('rad-1');
      expect(adequacy.room_heat_loss_w).toBeGreaterThan(0);
      expect(adequacy.current_output_at_mwt_75).toBeGreaterThan(0);
      expect(adequacy.current_output_at_mwt_55).toBeGreaterThan(0);
      expect(adequacy.current_output_at_mwt_45).toBeGreaterThan(0);
      
      // Output should decrease as MWT decreases
      expect(adequacy.current_output_at_mwt_75).toBeGreaterThan(adequacy.current_output_at_mwt_55);
      expect(adequacy.current_output_at_mwt_55).toBeGreaterThan(adequacy.current_output_at_mwt_45);
    });

    it('should flag radiator as adequate when output exceeds heat loss', () => {
      // Small heat loss, large radiator
      const smallWall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 2, // Small wall
        u_value_calculated: 0.55, // Well insulated
        surface_classification: 'EXTERNAL',
      };

      const largeRadiator: Emitter = {
        emitter_id: 'rad-1',
        room_id: 'room-1',
        type: 'radiator',
        radiator_details: {
          panel_type: 'K2',
          height_mm: 800,
          width_mm: 1800, // Large radiator
          depth_mm: 100,
        },
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [smallWall],
        emitters: [largeRadiator],
        designConditions,
      });

      const adequacy = result.roomHeatLoss.emitter_adequacy!;
      expect(adequacy.recommended_action).toBe('ok');
      expect(adequacy.adequate_at_mwt_45).toBe(true);
    });

    it('should flag radiator as needing upsize when undersized', () => {
      // Large heat loss, small radiator
      const largeWall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 20, // Large wall
        u_value_calculated: 2.1, // Poor insulation
        surface_classification: 'EXTERNAL',
      };

      const smallRadiator: Emitter = {
        emitter_id: 'rad-1',
        room_id: 'room-1',
        type: 'radiator',
        radiator_details: {
          panel_type: 'P+', // Single panel, no convector
          height_mm: 400,
          width_mm: 600, // Small radiator
          depth_mm: 60,
        },
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [largeWall],
        emitters: [smallRadiator],
        designConditions,
      });

      const adequacy = result.roomHeatLoss.emitter_adequacy!;
      expect(['upsize', 'major_upsize', 'replace']).toContain(adequacy.recommended_action);
      expect(adequacy.adequate_at_mwt_45).toBe(false);
    });
  });

  describe('Airtightness & ACH Calculations', () => {
    it('should convert n50 to effective ACH with default conversion factor', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const ach = calculateEffectiveACH({
        source: 'n50_test',
        n50_value: 10,
        conversion_factor: 20, // Default
      }, auditTrail);

      expect(ach).toBe(0.5);
      expect(auditTrail[0].field_name).toBe('airtightness_ach');
      expect(auditTrail[0].confidence_score).toBe('high');
      expect(auditTrail[0].notes).toContain('n50=10');
      expect(auditTrail[0].notes).toContain('conversion=20');
    });

    it('should use age band defaults when test not available', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const ach = calculateEffectiveACH({
        source: 'age_band',
        age_band: 'pre-1919',
      }, auditTrail);

      expect(ach).toBe(2.0); // very_leaky
      expect(auditTrail[0].confidence_score).toBe('low');
      expect(auditTrail[0].notes).toContain('age band');
    });

    it('should default to average ACH when no data available', () => {
      const auditTrail: AuditTrailEntry[] = [];
      
      const ach = calculateEffectiveACH({
        source: 'assumed',
      }, auditTrail);

      expect(ach).toBe(1.0); // average
      expect(auditTrail[0].confidence_score).toBe('low');
    });
  });

  describe('Setback & Recovery', () => {
    it('should not apply setback recovery when disabled', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        setbackRecoveryConfig: {
          enabled: false,
          uplift_factor_percent: 20,
        },
      });

      expect(result.roomHeatLoss.setback_recovery_w).toBe(0);
    });

    it('should apply setback recovery uplift when enabled', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        setbackRecoveryConfig: {
          enabled: true,
          uplift_factor_percent: 20,
          occupancy_pattern: 'intermittent',
        },
      });

      const baseLoss = (result.roomHeatLoss.fabric_loss_w ?? 0) + 
                      (result.roomHeatLoss.ventilation_loss_w ?? 0);
      const expectedRecovery = Math.round(baseLoss * 0.2);

      expect(result.roomHeatLoss.setback_recovery_w).toBe(expectedRecovery);
    });
  });

  describe('Audit Trail', () => {
    it('should create audit entries with all required fields', () => {
      const entry = createAuditEntry(
        'test_field',
        123,
        'LIDAR',
        'high',
        'Test notes'
      );

      expect(entry.field_name).toBe('test_field');
      expect(entry.value).toBe(123);
      expect(entry.source_type).toBe('LIDAR');
      expect(entry.confidence_score).toBe('high');
      expect(entry.notes).toBe('Test notes');
      expect(entry.timestamp).toBeDefined();
    });

    it('should generate comprehensive audit trail for room calculation', () => {
      const wall: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculateRoomHeatLoss({
        room: testRoom,
        walls: [wall],
        designConditions,
        thermalBridgingConfig: { enabled: true, uplift_factor_percent: 10 },
      });

      expect(result.auditTrail.length).toBeGreaterThan(0);
      
      // Should have entries for:
      // - Internal temp
      // - External temp
      // - Surface delta T
      // - Wall loss
      // - ACH
      // - Ventilation loss
      // - Thermal bridging
      
      const fieldNames = result.auditTrail.map(e => e.field_name);
      expect(fieldNames).toContain('room_internal_temp_c');
      expect(fieldNames).toContain('design_external_temp_c');
    });
  });

  describe('Whole Property Calculation', () => {
    it('should calculate total heat loss for multiple rooms', () => {
      const room1: Room = {
        room_id: 'room-1',
        name: 'Living Room',
        dimensions: { floor_area_m2: 20, volume_m3: 50 },
      };

      const room2: Room = {
        room_id: 'room-2',
        name: 'Kitchen',
        dimensions: { floor_area_m2: 15, volume_m3: 37.5 },
      };

      const wall1: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const wall2: Wall = {
        wall_id: 'wall-2',
        orientation: 'S',
        area_m2: 8,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const result = calculatePropertyHeatLoss({
        rooms: [room1, room2],
        wallsByRoom: new Map([
          ['room-1', [wall1]],
          ['room-2', [wall2]],
        ]),
        emittersByRoom: new Map(),
        designConditions,
      });

      expect(result.room_heat_losses).toHaveLength(2);
      expect(result.whole_house_heat_loss_w).toBeGreaterThan(0);
      expect(result.whole_house_heat_loss_kw).toBe(
        Math.round((result.whole_house_heat_loss_w! / 1000) * 10) / 10
      );
      expect(result.recommended_boiler_size_kw).toBeGreaterThan(result.whole_house_heat_loss_kw!);
      expect(result.audit_trail).toBeDefined();
      expect(result.audit_trail!.length).toBeGreaterThan(0);
    });

    it('should include emitter adequacy for all rooms with emitters', () => {
      const room1: Room = {
        room_id: 'room-1',
        name: 'Living Room',
        dimensions: { floor_area_m2: 20, volume_m3: 50 },
      };

      const wall1: Wall = {
        wall_id: 'wall-1',
        orientation: 'N',
        area_m2: 10,
        u_value_calculated: 1.6,
        surface_classification: 'EXTERNAL',
      };

      const radiator1: Emitter = {
        emitter_id: 'rad-1',
        room_id: 'room-1',
        type: 'radiator',
        radiator_details: {
          panel_type: 'K2',
          height_mm: 600,
          width_mm: 1000,
          depth_mm: 100,
        },
      };

      const result = calculatePropertyHeatLoss({
        rooms: [room1],
        wallsByRoom: new Map([['room-1', [wall1]]]),
        emittersByRoom: new Map([['room-1', [radiator1]]]),
        designConditions,
      });

      expect(result.room_heat_losses![0].emitter_adequacy).toBeDefined();
      expect(result.room_heat_losses![0].emitter_adequacy!.emitter_id).toBe('rad-1');
    });
  });
});

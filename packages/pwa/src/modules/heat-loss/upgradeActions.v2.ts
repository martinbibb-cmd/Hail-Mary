/**
 * Deterministic Upgrade Actions (v2)
 *
 * Context-aware actions driven by risk flag analysis
 */

import type { Wall } from '@hail-mary/shared';
import type { RiskFlag, UpgradeAction } from './types.v2';

/**
 * Generate upgrade actions for a room based on risk flags
 *
 * Returns actions sorted by priority (highest first)
 */
export function getUpgradeActions(
  roomId: string,
  riskFlags: RiskFlag[],
  walls: Wall[]
): UpgradeAction[] {
  const actions: UpgradeAction[] = [];

  // 1. Geometry assumed (highest priority for heat loss accuracy)
  if (riskFlags.includes('GEOMETRY_ASSUMED')) {
    actions.push({
      action_id: `${roomId}_scan_geometry`,
      type: 'scan_geometry',
      label: 'Scan Geometry (RoomPlan)',
      reason: 'Room dimensions assumed - scan for accurate floor area & volume',
      estimated_time_sec: 60,
      target_risk_flags: ['GEOMETRY_ASSUMED'],
      priority: 1,
    });
  }

  // 2. Wall construction assumed (critical for external walls)
  if (riskFlags.includes('WALL_CONSTRUCTION_ASSUMED')) {
    actions.push({
      action_id: `${roomId}_confirm_wall`,
      type: 'confirm_wall',
      label: 'Confirm Wall Type',
      reason:
        'Wall construction type assumed - confirm solid/cavity/timber (10 sec)',
      estimated_time_sec: 10,
      target_risk_flags: ['WALL_CONSTRUCTION_ASSUMED'],
      priority: 2,
    });

    actions.push({
      action_id: `${roomId}_confirm_insulation`,
      type: 'confirm_insulation',
      label: 'Confirm Insulation Status',
      reason:
        'Insulation status unknown - confirm none/filled/partial (10 sec)',
      estimated_time_sec: 10,
      target_risk_flags: ['WALL_CONSTRUCTION_ASSUMED'],
      priority: 3,
    });
  }

  // 3. Glazing assumed
  if (riskFlags.includes('GLAZING_ASSUMED')) {
    actions.push({
      action_id: `${roomId}_confirm_glazing`,
      type: 'confirm_glazing',
      label: 'Confirm Glazing Type',
      reason:
        'Glazing U-value assumed - confirm single/double/triple (10 sec)',
      estimated_time_sec: 10,
      target_risk_flags: ['GLAZING_ASSUMED'],
      priority: 4,
    });
  }

  // 4. Unheated adjacent temp model
  if (riskFlags.includes('UNHEATED_ADJACENT_MODEL')) {
    actions.push({
      action_id: `${roomId}_set_unheated_temp`,
      type: 'set_unheated_temp',
      label: 'Set Unheated Space Temp Model',
      reason:
        'Garage/porch temp assumed - set fixed temp or offset from external (15 sec)',
      estimated_time_sec: 15,
      target_risk_flags: ['UNHEATED_ADJACENT_MODEL'],
      priority: 5,
    });
  }

  // 5. ACH assumed from age band
  if (riskFlags.includes('ACH_ASSUMED')) {
    actions.push({
      action_id: `${roomId}_set_ach_method`,
      type: 'set_ach_method',
      label: 'Set Airtightness Method',
      reason:
        'Air changes assumed from age band - confirm age or enter test result (20 sec)',
      estimated_time_sec: 20,
      target_risk_flags: ['ACH_ASSUMED'],
      priority: 6,
    });
  }

  // 6. Missing external walls (critical error)
  if (riskFlags.includes('MISSING_EXTERNAL_WALLS')) {
    actions.push({
      action_id: `${roomId}_scan_geometry`,
      type: 'scan_geometry',
      label: 'Scan to Identify External Walls',
      reason: 'No external walls detected - scan room to identify surfaces',
      estimated_time_sec: 60,
      target_risk_flags: ['MISSING_EXTERNAL_WALLS'],
      priority: 1, // Highest priority
    });
  }

  // 7. Always offer photo attachment (low priority)
  actions.push({
    action_id: `${roomId}_attach_photo`,
    type: 'attach_photo',
    label: 'Attach Photo Evidence',
    reason: 'Add visual evidence (photo/thermal/borescope)',
    estimated_time_sec: 30,
    target_risk_flags: [], // Helps all risks
    priority: 99, // Lowest priority
  });

  // Sort by priority (ascending, so priority 1 is first)
  return actions.sort((a, b) => a.priority - b.priority);
}

/**
 * Get the top priority action (what to show as "next best action")
 */
export function getTopPriorityAction(
  roomId: string,
  riskFlags: RiskFlag[],
  walls: Wall[]
): UpgradeAction | null {
  const actions = getUpgradeActions(roomId, riskFlags, walls);
  // Return first action that's not photo attachment
  return actions.find((a) => a.type !== 'attach_photo') || actions[0] || null;
}

/**
 * Get next best action message (one-liner for dashboard)
 */
export function getNextBestActionMessage(
  riskFlags: RiskFlag[],
  walls: Wall[]
): string {
  if (riskFlags.length === 0) {
    return 'Confidence is high - no urgent actions needed';
  }

  const topAction = getTopPriorityAction('', riskFlags, walls);
  return topAction ? topAction.reason : 'Review assumptions';
}

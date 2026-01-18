/**
 * Survey Helper Slots Catalog
 * 
 * This file contains all the helper "slots" - predefined questions with chip options
 * that the Survey Helper engine uses to gather structured data during site surveys.
 * 
 * Modules: core, central_heating, heat_pump, pv, ev, hazards
 */

import type { SurveySlot } from './types.js';

// ============================================
// Core / Fabric / Lifestyle Slots
// ============================================

export const coreSlots: SurveySlot[] = [
  // 2.1 Property type
  {
    id: 'core.property.type',
    module: 'core',
    topic: 'fabric',
    path: 'property.propertyType',
    priority: 'critical',
    question: 'What type of home is this?',
    chipOptions: [
      { label: 'House (semi/detached/terrace)', value: 'house' },
      { label: 'Flat / Maisonette', value: 'flat' },
      { label: 'Bungalow / Chalet', value: 'bungalow' },
      { label: 'Other / mixed', value: 'other' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
    notes: 'Can often be inferred from transcript; helper only asks if still unknown.',
  },
  // 2.2 Approx build era
  {
    id: 'core.property.build_era',
    module: 'core',
    topic: 'fabric',
    path: 'property.buildYearApprox',
    priority: 'important',
    question: 'Roughly when was the property built?',
    chipOptions: [
      { label: 'Pre-1930', value: 'pre-1930' },
      { label: '1930–1950', value: '1930-1950' },
      { label: '1950–1970', value: '1950-1970' },
      { label: '1970–1990', value: '1970-1990' },
      { label: '1990–2010', value: '1990-2010' },
      { label: '2010 or newer', value: '2010+' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 2.3 Loft insulation band
  {
    id: 'core.fabric.loft_insulation',
    module: 'core',
    topic: 'fabric',
    path: 'property.loftInsulationDepthMm',
    priority: 'critical',
    question: 'How would you describe the loft insulation?',
    chipOptions: [
      { label: 'None / very little', value: '<50' },
      { label: 'A bit, but not full depth', value: '50-149' },
      { label: 'Around 150–249 mm', value: '150-249' },
      { label: 'Good (250+ mm)', value: '250+' },
      { label: 'No loft / can\'t see', value: null },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Critical for HP / PAS calculations.',
  },
  // 2.4 Glazing type
  {
    id: 'core.fabric.glazing',
    module: 'core',
    topic: 'fabric',
    path: 'property.glazingType',
    priority: 'important',
    question: 'Most windows are…?',
    chipOptions: [
      { label: 'Single glazed or old', value: 'single' },
      { label: 'Mostly double glazed', value: 'double' },
      { label: 'Triple / very modern', value: 'triple' },
      { label: 'Mixed / hard to say', value: 'mixed' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 2.5 Occupancy pattern
  {
    id: 'core.lifestyle.occupancy',
    module: 'core',
    topic: 'lifestyle',
    path: 'occupancyPattern.homeAllDay',
    priority: 'important',
    question: 'Is someone usually at home in the day?',
    chipOptions: [
      { label: 'Yes, most days', value: true },
      { label: 'Only evenings/weekends', value: false },
      { label: 'Varies / not sure', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 2.6 Hot water demand band
  {
    id: 'core.lifestyle.hot_water_profile',
    module: 'core',
    topic: 'lifestyle',
    path: 'occupancyPattern.hotWaterProfile',
    priority: 'critical',
    question: 'How would you describe their hot water use?',
    chipOptions: [
      { label: 'Low (1 bathroom, quick showers)', value: 'low' },
      { label: 'Medium (family, normal use)', value: 'medium' },
      { label: 'High (baths, multiple showers)', value: 'high' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
    notes: 'Critical for combi vs cylinder, HP sizing.',
  },
];

// ============================================
// Central Heating Module Slots
// ============================================

export const centralHeatingSlots: SurveySlot[] = [
  // 3.1 System type
  {
    id: 'ch.system.type',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.systemType',
    priority: 'critical',
    question: 'What sort of boiler system is this?',
    chipOptions: [
      { label: 'Combi', value: 'combi' },
      { label: 'Storage combi', value: 'storage_combi' },
      { label: 'System (with cylinder)', value: 'system' },
      { label: 'Regular / heat-only + cylinder', value: 'regular' },
      { label: 'Back boiler', value: 'back_boiler' },
      { label: 'Other / not sure', value: 'other' },
    ],
    allowSkip: false,
    triggerMode: 'topic_change',
    notes: 'Triggered when you first focus on boiler.',
  },
  // 3.2 Fuel type
  {
    id: 'ch.system.fuel',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.boilerFuel',
    priority: 'critical',
    question: 'What fuel does the boiler run on?',
    chipOptions: [
      { label: 'Mains gas', value: 'mains_gas' },
      { label: 'LPG (bottles/tank)', value: 'lpg' },
      { label: 'Oil', value: 'oil' },
      { label: 'Electric', value: 'electric' },
      { label: 'Other / not sure', value: 'other' },
    ],
    allowSkip: false,
    triggerMode: 'on_request',
    notes: 'Often obvious but nice confirmation.',
  },
  // 3.3 Boiler age band
  {
    id: 'ch.boiler.age_band',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.boilerApproxAgeYears',
    priority: 'important',
    question: 'Roughly how old is this boiler?',
    chipOptions: [
      { label: 'Under 10 years', value: '<10' },
      { label: '10–20 years', value: '10-20' },
      { label: '20–30 years', value: '20-30' },
      { label: '30–40 years', value: '30-40' },
      { label: '40+ years', value: '40+' },
      { label: 'No idea', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 3.4 Boiler condition
  {
    id: 'ch.boiler.condition',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.generalCondition',
    priority: 'important',
    question: 'How would you describe the condition of the boiler?',
    chipOptions: [
      { label: 'Good / tidy', value: 'good' },
      { label: 'Tired but OK', value: 'tired' },
      { label: 'Poor / on last legs', value: 'poor' },
      { label: 'Unsafe / condemned', value: 'condemned' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 3.5 Flue category
  {
    id: 'ch.flue.category',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.flueCategory',
    priority: 'critical',
    question: 'What type of flue is it?',
    chipOptions: [
      { label: 'Round fanned on a wall', value: 'fanned_round' },
      { label: 'Square/rectangular fanned', value: 'fanned_square' },
      { label: 'Balanced flue plate', value: 'balanced' },
      { label: 'Open flue into chimney', value: 'open_flue' },
      { label: 'Back boiler / fireplace', value: 'back_boiler' },
      { label: 'Not sure', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Triggered when looking at the boiler.',
  },
  // 3.6 Flue route
  {
    id: 'ch.flue.route',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.existingHeatSource.flueRoute',
    priority: 'important',
    question: 'Where does the flue run?',
    chipOptions: [
      { label: 'Out through wall (horizontal)', value: 'horizontal_wall' },
      { label: 'Vertical through pitched roof', value: 'vertical_pitched_roof' },
      { label: 'Vertical through flat roof', value: 'vertical_flat_roof' },
      { label: 'Ridge tile vent', value: 'ridge_tile_vent' },
      { label: 'Into chimney', value: 'into_chimney' },
      { label: 'Other / not sure', value: 'other' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 3.7 Pipework type (microbore etc.)
  {
    id: 'ch.pipework.type',
    module: 'central_heating',
    topic: 'emitters',
    path: 'centralHeating.emitters.microborePresence',
    priority: 'critical',
    question: 'What\'s the pipework like overall?',
    chipOptions: [
      { label: 'Mostly microbore (8–10 mm)', value: 'microbore' },
      { label: 'Mixed microbore and 15mm+', value: 'mixed' },
      { label: 'Mostly 15mm+ two-pipe', value: 'standard_two_pipe' },
      { label: 'Some single-pipe loops', value: 'single_pipe_present' },
      { label: 'Not sure', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Triggered when talking rads.',
  },
  // 3.8 System water condition (sludge)
  {
    id: 'ch.water.sludge_level',
    module: 'central_heating',
    topic: 'emitters',
    path: 'centralHeating.waterQuality.sludgeSeverity',
    priority: 'critical',
    question: 'From what you\'ve seen, how sludged does the system look?',
    chipOptions: [
      { label: 'Low / looks clean', value: 'low' },
      { label: 'Medium (some dark water, a few cool spots)', value: 'medium' },
      { label: 'High (black water, lots of cold bottoms)', value: 'high' },
      { label: 'Don\'t know / not checked', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
    notes: 'Critical for quoting flush.',
  },
  // 3.9 Filter present
  {
    id: 'ch.water.filter_present',
    module: 'central_heating',
    topic: 'boiler',
    path: 'centralHeating.waterQuality.filterFitted',
    priority: 'important',
    question: 'Is there a magnetic filter on the system?',
    chipOptions: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure / can\'t see', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 3.10 Controls level
  {
    id: 'ch.controls.level',
    module: 'central_heating',
    topic: 'controls',
    path: 'centralHeating.controlsSummary',
    priority: 'important',
    question: 'What sort of controls do they have now?',
    chipOptions: [
      { label: 'Basic timer + boiler stat', value: 'basic' },
      { label: 'Programmable room stat', value: 'programmable' },
      { label: 'Smart controls (Hive/Nest/etc.)', value: 'smart' },
      { label: 'No real controls', value: 'none' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
];

// ============================================
// Heat Pump Module Slots
// ============================================

export const heatPumpSlots: SurveySlot[] = [
  // 4.1 HP vs hybrid intent
  {
    id: 'hp.system.mode',
    module: 'heat_pump',
    topic: 'hp_overview',
    path: 'heatPump.proposedSystem.replaceBoilerCompletely',
    priority: 'critical',
    question: 'Plan is…?',
    chipOptions: [
      { label: 'Heat pump only (boiler gone)', value: true },
      { label: 'Hybrid (keep boiler as backup)', value: false },
      { label: 'Still deciding', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 4.2 Design flow temp target
  {
    id: 'hp.flow_temp.target',
    module: 'heat_pump',
    topic: 'emitters',
    path: 'heatPump.emitterCheck.designFlowTempTarget',
    priority: 'critical',
    question: 'What flow temperature are you roughly aiming for with the heat pump?',
    chipOptions: [
      { label: '35–40°C (very low)', value: 40 },
      { label: '45–50°C (typical)', value: 50 },
      { label: '55°C+ (legacy system limits)', value: 55 },
      { label: 'Not decided yet', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 4.3 Radiator suitability headline
  {
    id: 'hp.emitters.overview',
    module: 'heat_pump',
    topic: 'emitters',
    path: 'heatPump.emitterCheck.roomsNeedingUpsize',
    priority: 'critical',
    question: 'Across the house, do you think many radiators will need upsizing for a heat pump?',
    chipOptions: [
      { label: 'Most are fine', value: 'few_changes' },
      { label: 'Some need upsizing', value: 'some_changes' },
      { label: 'Many / most need upsizing', value: 'major_changes' },
      { label: 'Too early to say', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 4.4 Cylinder situation for HP
  {
    id: 'hp.cylinder.status',
    module: 'heat_pump',
    topic: 'cylinder',
    path: 'heatPump.plantArea.existingCylinderReusePossible',
    priority: 'critical',
    question: 'For hot water, what\'s the plan?',
    chipOptions: [
      { label: 'Reuse existing cylinder (HP-ready)', value: 'reuse' },
      { label: 'Replace existing cylinder', value: 'replace' },
      { label: 'No cylinder now – need new location', value: 'new_location' },
      { label: 'Not sure yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Triggered when in cylinder/airing cupboard.',
  },
  // 4.5 Outdoor unit candidate
  {
    id: 'hp.outdoor.location_quality',
    module: 'heat_pump',
    topic: 'hp_outdoor',
    path: 'heatPump.outdoorUnit.candidateLocationQuality',
    priority: 'critical',
    question: 'Is there a decent spot outside for the heat pump?',
    chipOptions: [
      { label: 'Yes – good clear spot', value: 'good' },
      { label: 'Yes – but a bit tight/awkward', value: 'ok' },
      { label: 'Not really – tricky', value: 'poor' },
      { label: 'Not looked yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Triggered when leaving garden/exterior.',
  },
  // 4.6 Main fuse adequacy for HP
  {
    id: 'hp.electrics.main_fuse_ok',
    module: 'heat_pump',
    topic: 'electrics',
    path: 'heatPump.electrical.mainFuseOkForHPAndRest',
    priority: 'critical',
    question: 'Based on what\'s there, does the main fuse look OK for a heat pump?',
    chipOptions: [
      { label: 'Yes, looks fine', value: 'ok' },
      { label: 'Borderline – may need managing', value: 'borderline' },
      { label: 'No, likely needs upgrade', value: 'upgrade_required' },
      { label: 'Not sure yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 4.7 Noise / neighbour risk
  {
    id: 'hp.outdoor.noise_risk',
    module: 'heat_pump',
    topic: 'hp_outdoor',
    path: 'heatPump.outdoorUnit.noiseRiskLevel',
    priority: 'important',
    question: 'Noise-wise, how sensitive is the proposed outdoor unit location?',
    chipOptions: [
      { label: 'Low risk (away from neighbours)', value: 'low' },
      { label: 'Medium (some nearby windows)', value: 'medium' },
      { label: 'High (very close to neighbour/windows)', value: 'high' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
];

// ============================================
// Solar PV Module Slots
// ============================================

export const solarPvSlots: SurveySlot[] = [
  // 5.1 Main usable roof
  {
    id: 'pv.roof.main_aspect',
    module: 'pv',
    topic: 'roof',
    path: 'solarPv.roofUse.mainPitchAspect',
    priority: 'critical',
    question: 'What\'s the main usable roof facing?',
    chipOptions: [
      { label: 'South', value: 'S' },
      { label: 'South-east', value: 'SE' },
      { label: 'South-west', value: 'SW' },
      { label: 'East', value: 'E' },
      { label: 'West', value: 'W' },
      { label: 'Multiple / complex', value: 'mixed' },
    ],
    allowSkip: true,
    triggerMode: 'topic_change',
    notes: 'Triggered while on roof.',
  },
  // 5.2 Shading level on main pitch
  {
    id: 'pv.roof.shading_main',
    module: 'pv',
    topic: 'roof',
    path: 'solarPv.roofUse.shadingSummary',
    priority: 'critical',
    question: 'How shaded is the main roof where panels would go?',
    chipOptions: [
      { label: 'No real shade', value: 'none' },
      { label: 'Mostly morning shade', value: 'morning' },
      { label: 'Mostly afternoon/evening shade', value: 'afternoon' },
      { label: 'Heavily shaded', value: 'heavy' },
      { label: 'Not sure', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 5.3 Roof condition
  {
    id: 'pv.roof.condition',
    module: 'pv',
    topic: 'roof',
    path: 'solarPv.structuralAndAccess.roofConditionSummary',
    priority: 'important',
    question: 'What\'s the condition of the roof like?',
    chipOptions: [
      { label: 'Good / sound', value: 'good' },
      { label: 'OK but ageing', value: 'tired' },
      { label: 'Poor / needs work', value: 'poor' },
      { label: 'Not sure', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 5.4 Inverter location viability
  {
    id: 'pv.inverter.location_quality',
    module: 'pv',
    topic: 'electrics',
    path: 'solarPv.electricalIntegration.inverterLocationQuality',
    priority: 'important',
    question: 'Is there a sensible place indoors for the inverter?',
    chipOptions: [
      { label: 'Yes – easy (loft/garage/utility)', value: 'good' },
      { label: 'Yes – but a bit awkward', value: 'ok' },
      { label: 'No obvious spot', value: 'poor' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 5.5 Main fuse / export limits relevance
  {
    id: 'pv.electrics.export_limit_risk',
    module: 'pv',
    topic: 'electrics',
    path: 'solarPv.electricalIntegration.exportLimitExpected',
    priority: 'critical',
    question: 'Do you expect any grid/export limit issues here?',
    chipOptions: [
      { label: 'Standard 3.68kW fine', value: '3.68_ok' },
      { label: 'Larger system – DNO approval likely', value: 'dno_required' },
      { label: 'Not sure yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 5.6 Battery interest
  {
    id: 'pv.battery.interest',
    module: 'pv',
    topic: 'lifestyle',
    path: 'solarPv.storageAndFuture.batteryInterestLevel',
    priority: 'important',
    question: 'Are they interested in battery storage?',
    chipOptions: [
      { label: 'Yes, now', value: 'now' },
      { label: 'Maybe later', value: 'later' },
      { label: 'No', value: 'no' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
];

// ============================================
// EV Charging Module Slots
// ============================================

export const evSlots: SurveySlot[] = [
  // 6.1 Off-street parking
  {
    id: 'ev.parking.off_street',
    module: 'ev',
    topic: 'parking',
    path: 'ev.parking.offStreet',
    priority: 'critical',
    question: 'Do they have off-street parking where the car can charge?',
    chipOptions: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Shared / complex', value: 'shared' },
    ],
    allowSkip: false,
    triggerMode: 'topic_change',
    notes: 'Triggered entering parking discussion.',
  },
  // 6.2 Charger location + route complexity
  {
    id: 'ev.route.complexity',
    module: 'ev',
    topic: 'parking',
    path: 'ev.parking.cableRouteComplexity',
    priority: 'critical',
    question: 'How complex does the cable route from the board to the charger look?',
    chipOptions: [
      { label: 'Simple (short, straight)', value: 'simple' },
      { label: 'Moderate (a few turns / runs)', value: 'moderate' },
      { label: 'Complex (long run / lifting floors)', value: 'complex' },
      { label: 'Not checked yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 6.3 Main fuse adequacy for EV
  {
    id: 'ev.electrics.main_fuse_ok',
    module: 'ev',
    topic: 'electrics',
    path: 'ev.electricalCapacity.mainFuseOkForEV',
    priority: 'critical',
    question: 'With an EV charger, does the main fuse look OK?',
    chipOptions: [
      { label: 'Yes, should be fine', value: 'ok' },
      { label: 'Borderline – may need load management', value: 'needs_load_management' },
      { label: 'No – likely needs upgrade', value: 'upgrade_required' },
      { label: 'Not sure yet', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 6.4 Earthing awareness (PME / TT)
  {
    id: 'ev.electrics.earthing_known',
    module: 'ev',
    topic: 'electrics',
    path: 'ev.earthingAndRegs.earthingTypeKnown',
    priority: 'important',
    question: 'Do you know (or have you noted) the earthing type?',
    chipOptions: [
      { label: 'PME / TN-C-S', value: 'tn_c_s' },
      { label: 'TN-S', value: 'tn_s' },
      { label: 'TT', value: 'tt' },
      { label: 'Not sure', value: 'unknown' },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 6.5 PV integration interest
  {
    id: 'ev.smart.pv_integration',
    module: 'ev',
    topic: 'lifestyle',
    path: 'ev.smartIntegration.PVIntegrationPlanned',
    priority: 'important',
    question: 'Do they want the charger to work with solar PV (now or later)?',
    chipOptions: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Not sure', value: null },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
];

// ============================================
// Hazards / Legacy Materials Slots
// ============================================

export const hazardsSlots: SurveySlot[] = [
  // 7.1 Asbestos suspicion
  {
    id: 'haz.asbestos.suspected',
    module: 'hazards',
    topic: 'hazards',
    path: 'hazards.asbestos.suspectedLocations',
    priority: 'critical',
    question: 'Is there any known or suspected asbestos in areas we\'d be working?',
    chipOptions: [
      { label: 'Yes – known', value: ['known'] },
      { label: 'Yes – suspected', value: ['suspected'] },
      { label: 'No / none obvious', value: [] },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 7.2 Monkey muck confirmation (rare hazard)
  {
    id: 'haz.asbestos.monkey_muck',
    module: 'hazards',
    topic: 'hazards',
    path: 'hazards.asbestos.monkeyMuckObserved',
    priority: 'critical',
    question: 'Just to log this properly: did you definitely see \'monkey muck\' (that asbestos-type paste) here?',
    chipOptions: [
      { label: 'Yes, confirmed', value: 'confirmed' },
      { label: 'Suspected only', value: 'suspected' },
      { label: 'No, it\'s something else', value: 'no' },
    ],
    allowSkip: false,
    triggerMode: 'rare_hazard',
    notes: 'Only show if transcript or manual flag contains "monkey muck" / "asbestos paste".',
  },
  // 7.3 Passivated steel / legacy rads
  {
    id: 'haz.legacy.passivated_steel_rads',
    module: 'hazards',
    topic: 'emitters',
    path: 'hazards.legacyMaterials',
    priority: 'important',
    question: 'Any passivated steel radiators or other legacy bits you want to flag?',
    chipOptions: [
      { label: 'Yes – passivated steel rads', value: ['passivated_steel_radiators'] },
      { label: 'Yes – other legacy kit', value: ['other_legacy'] },
      { label: 'No / nothing notable', value: [] },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
  // 7.4 Access restrictions
  {
    id: 'haz.access.restrictions',
    module: 'hazards',
    topic: 'hazards',
    path: 'hazards.accessRestrictions',
    priority: 'important',
    question: 'Any parts of the property off-limits or \'don\'t touch\' for us?',
    chipOptions: [
      { label: 'Yes – note in text', value: ['noted'] },
      { label: 'No', value: [] },
    ],
    allowSkip: true,
    triggerMode: 'on_request',
  },
];

// ============================================
// Export All Slots
// ============================================

export const allSurveySlots: SurveySlot[] = [
  ...coreSlots,
  ...centralHeatingSlots,
  ...heatPumpSlots,
  ...solarPvSlots,
  ...evSlots,
  ...hazardsSlots,
];

/**
 * Get slots for specific modules
 */
export function getSlotsForModules(modules: string[]): SurveySlot[] {
  return allSurveySlots.filter(slot => 
    modules.includes(slot.module) || slot.module === 'core' || slot.module === 'hazards'
  );
}

/**
 * Get slots for a specific topic
 */
export function getSlotsForTopic(topic: string, modules?: string[]): SurveySlot[] {
  let slots = allSurveySlots.filter(slot => slot.topic === topic);
  if (modules) {
    slots = slots.filter(slot => 
      modules.includes(slot.module) || slot.module === 'core' || slot.module === 'hazards'
    );
  }
  return slots;
}

/**
 * Get a slot by ID
 */
export function getSlotById(id: string): SurveySlot | undefined {
  return allSurveySlots.find(slot => slot.id === id);
}

/**
 * Get critical slots for a module
 */
export function getCriticalSlotsForModule(module: string): SurveySlot[] {
  return allSurveySlots.filter(slot => 
    slot.module === module && slot.priority === 'critical'
  );
}

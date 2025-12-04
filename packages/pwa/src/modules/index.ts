/**
 * Mini Apps / Modules Index
 * 
 * Exports all survey modules for the Hail Mary architecture.
 * 
 * Phase 1 (Live):
 * - PropertyApp - Core property details
 * - CentralHeatingApp - Boiler/CH survey
 * - HazardsApp - Safety hazards
 * 
 * Phase 1 (Stubs/Dead Legs):
 * - HeatPumpApp - HP suitability (Phase 2)
 * - SolarPvApp - Solar PV (Phase 2)
 * - EvApp - EV charging (Phase 2)
 * - RoadmapApp - Upgrade roadmap (Phase 3)
 * - OtherTradesApp - Future trades gateway
 */

// Phase 1 - Live modules
export { PropertyApp } from './property';
export { CentralHeatingApp } from './central-heating';
export { HazardsApp } from './hazards';

// Phase 1 - Stub modules (dead legs)
export { HeatPumpApp } from './heat-pump';
export { SolarPvApp } from './pv';
export { EvApp } from './ev';
export { RoadmapApp } from './roadmap';
export { OtherTradesApp } from './other';

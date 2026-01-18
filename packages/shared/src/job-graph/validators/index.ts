/**
 * Regulatory Validators Index
 *
 * Exports all validators for regulatory compliance checking
 */

export * from './bs5440.js';
export * from './bs7671.js';
export * from './hsg264.js';
export * from './manufacturerInstructions.js';

import { BS5440Validator } from './bs5440.js';
import { BS7671Validator } from './bs7671.js';
import { HSG264Validator } from './hsg264.js';
import { ManufacturerInstructionsValidator } from './manufacturerInstructions.js';
import { Validator } from '../types.js';

/**
 * Get all validators
 */
export function getAllValidators(): Validator[] {
  return [
    new ManufacturerInstructionsValidator(), // Check MI FIRST - it takes precedence
    new BS5440Validator(),
    new BS7671Validator(),
    new HSG264Validator(),
  ];
}

/**
 * Get validator by name
 */
export function getValidator(name: string): Validator | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.name === name || v.standard === name);
}

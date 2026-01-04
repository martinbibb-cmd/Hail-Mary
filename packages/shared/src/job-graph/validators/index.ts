/**
 * Regulatory Validators Index
 *
 * Exports all validators for regulatory compliance checking
 */

export * from './bs5440';
export * from './bs7671';
export * from './hsg264';
export * from './manufacturerInstructions';

import { BS5440Validator } from './bs5440';
import { BS7671Validator } from './bs7671';
import { HSG264Validator } from './hsg264';
import { ManufacturerInstructionsValidator } from './manufacturerInstructions';
import { Validator } from '../types';

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

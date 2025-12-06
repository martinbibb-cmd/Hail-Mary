/**
 * Surveyor Engine
 * 
 * A platform-agnostic survey workflow state machine.
 * Can be used by both Web App (PWA) and Mobile App.
 */

export { SurveyEngine } from './engine';
export type { 
  SurveyNode, 
  SurveyState, 
  InputType, 
  ValidationRule, 
  NextLogic 
} from './types';

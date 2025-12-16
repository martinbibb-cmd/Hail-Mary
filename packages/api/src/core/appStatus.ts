/**
 * Application Status Singleton
 * 
 * Tracks degraded subsystems to enable "unsinkable mode" - the API always starts
 * even if optional subsystems fail. This prevents complete service outages when
 * non-critical components have issues.
 * 
 * Usage:
 *   import { appStatus } from './core/appStatus';
 *   
 *   try {
 *     // Initialize optional subsystem
 *     await initializeWhisper();
 *   } catch (error) {
 *     appStatus.setDegraded('stt', 'Whisper initialization failed: ' + error.message);
 *     // Continue with fallback/mock provider
 *   }
 */

export interface DegradedStatus {
  config: boolean;
  stt: boolean;
  transcription: boolean;
  email: boolean;
  database: boolean;
  [key: string]: boolean;
}

export interface AppStatus {
  degraded: DegradedStatus;
  notes: string[];
  setDegraded: (key: keyof DegradedStatus | string, note: string) => void;
  isDegraded: (key: keyof DegradedStatus | string) => boolean;
  hasAnyDegraded: () => boolean;
  getAllDegraded: () => string[];
  getNotes: () => string[];
  reset: () => void;
}

// Internal state
const degradedState: DegradedStatus = {
  config: false,
  stt: false,
  transcription: false,
  email: false,
  database: false,
};

const notes: string[] = [];

/**
 * Application Status Singleton
 * Provides global state tracking for degraded subsystems
 */
export const appStatus: AppStatus = {
  degraded: degradedState,
  notes,

  /**
   * Mark a subsystem as degraded with a note
   * @param key - The subsystem key (config, stt, transcription, email, database, etc.)
   * @param note - Human-readable description of the issue
   */
  setDegraded(key: keyof DegradedStatus | string, note: string): void {
    degradedState[key] = true;
    const timestamp = new Date().toISOString();
    const noteWithTimestamp = `[${timestamp}] ${key}: ${note}`;
    notes.push(noteWithTimestamp);
    console.warn(`⚠️  Degraded: ${noteWithTimestamp}`);
  },

  /**
   * Check if a specific subsystem is degraded
   * @param key - The subsystem key
   * @returns true if the subsystem is degraded
   */
  isDegraded(key: keyof DegradedStatus | string): boolean {
    return degradedState[key] === true;
  },

  /**
   * Check if any subsystem is degraded
   * @returns true if at least one subsystem is degraded
   */
  hasAnyDegraded(): boolean {
    return Object.values(degradedState).some(v => v === true);
  },

  /**
   * Get list of all degraded subsystems
   * @returns Array of subsystem keys that are degraded
   */
  getAllDegraded(): string[] {
    return Object.keys(degradedState).filter(key => degradedState[key] === true);
  },

  /**
   * Get all degradation notes
   * @returns Array of all notes
   */
  getNotes(): string[] {
    return [...notes];
  },

  /**
   * Reset all degraded flags and notes (for testing)
   */
  reset(): void {
    Object.keys(degradedState).forEach(key => {
      degradedState[key] = false;
    });
    notes.length = 0;
  },
};

export default appStatus;

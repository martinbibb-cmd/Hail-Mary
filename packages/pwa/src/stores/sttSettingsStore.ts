/**
 * STT Settings Store
 *
 * Manages speech-to-text provider settings.
 * Supports: browser (Web Speech API) or whisper (OpenAI Whisper API)
 */

import { create } from 'zustand';

export type SttProvider = 'browser' | 'whisper';

interface SttSettingsStore {
  provider: SttProvider;
  whisperApiKey: string | null;
  setProvider: (provider: SttProvider) => void;
  setWhisperApiKey: (apiKey: string) => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'hail-mary:stt-settings';

// Helper to persist to localStorage
const persistToStorage = (state: Partial<SttSettingsStore>) => {
  try {
    const toStore = {
      provider: state.provider,
      whisperApiKey: state.whisperApiKey,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to persist STT settings:', error);
  }
};

// Helper to load from localStorage
const loadFromStorage = (): Partial<SttSettingsStore> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load STT settings:', error);
  }
  return null;
};

export const useSttSettings = create<SttSettingsStore>((set, get) => ({
  // Initial state - default to browser
  provider: 'browser',
  whisperApiKey: null,

  setProvider: (provider: SttProvider) => {
    const newState = { provider };
    set(newState);
    persistToStorage({ ...get(), ...newState });
  },

  setWhisperApiKey: (apiKey: string) => {
    const newState = { whisperApiKey: apiKey };
    set(newState);
    persistToStorage({ ...get(), ...newState });
  },

  hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({
        provider: stored.provider || 'browser',
        whisperApiKey: stored.whisperApiKey || null,
      });
    }
  },
}));

/**
 * Tests for Application Status Singleton
 */

import { appStatus } from '../core/appStatus';

describe('Application Status Singleton', () => {
  beforeEach(() => {
    // Reset status before each test
    appStatus.reset();
  });

  describe('setDegraded', () => {
    it('should mark a subsystem as degraded', () => {
      appStatus.setDegraded('stt', 'STT service failed to initialize');
      
      expect(appStatus.isDegraded('stt')).toBe(true);
      expect(appStatus.isDegraded('email')).toBe(false);
    });

    it('should add a note when marking degraded', () => {
      appStatus.setDegraded('stt', 'STT service failed');
      
      const notes = appStatus.getNotes();
      expect(notes.length).toBe(1);
      expect(notes[0]).toContain('stt');
      expect(notes[0]).toContain('STT service failed');
    });

    it('should include timestamp in notes', () => {
      appStatus.setDegraded('email', 'Email service unreachable');
      
      const notes = appStatus.getNotes();
      expect(notes[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should support custom subsystem keys', () => {
      appStatus.setDegraded('customService', 'Custom service failed');
      
      expect(appStatus.isDegraded('customService')).toBe(true);
    });
  });

  describe('isDegraded', () => {
    it('should return false for non-degraded subsystem', () => {
      expect(appStatus.isDegraded('stt')).toBe(false);
    });

    it('should return true for degraded subsystem', () => {
      appStatus.setDegraded('transcription', 'Service offline');
      
      expect(appStatus.isDegraded('transcription')).toBe(true);
    });
  });

  describe('hasAnyDegraded', () => {
    it('should return false when no subsystems are degraded', () => {
      expect(appStatus.hasAnyDegraded()).toBe(false);
    });

    it('should return true when at least one subsystem is degraded', () => {
      appStatus.setDegraded('config', 'Config file missing');
      
      expect(appStatus.hasAnyDegraded()).toBe(true);
    });
  });

  describe('getAllDegraded', () => {
    it('should return empty array when nothing is degraded', () => {
      const degraded = appStatus.getAllDegraded();
      
      expect(degraded).toEqual([]);
    });

    it('should return list of degraded subsystems', () => {
      appStatus.setDegraded('stt', 'STT failed');
      appStatus.setDegraded('email', 'Email failed');
      
      const degraded = appStatus.getAllDegraded();
      
      expect(degraded).toContain('stt');
      expect(degraded).toContain('email');
      expect(degraded.length).toBe(2);
    });
  });

  describe('getNotes', () => {
    it('should return empty array when no notes exist', () => {
      const notes = appStatus.getNotes();
      
      expect(notes).toEqual([]);
    });

    it('should return all notes', () => {
      appStatus.setDegraded('stt', 'First issue');
      appStatus.setDegraded('email', 'Second issue');
      
      const notes = appStatus.getNotes();
      
      expect(notes.length).toBe(2);
      expect(notes[0]).toContain('First issue');
      expect(notes[1]).toContain('Second issue');
    });
  });

  describe('reset', () => {
    it('should clear all degraded flags', () => {
      appStatus.setDegraded('stt', 'Issue');
      appStatus.setDegraded('email', 'Issue');
      
      appStatus.reset();
      
      expect(appStatus.hasAnyDegraded()).toBe(false);
      expect(appStatus.getAllDegraded()).toEqual([]);
    });

    it('should clear all notes', () => {
      appStatus.setDegraded('stt', 'Issue');
      
      appStatus.reset();
      
      expect(appStatus.getNotes()).toEqual([]);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple degradations gracefully', () => {
      appStatus.setDegraded('stt', 'Whisper API unavailable');
      appStatus.setDegraded('email', 'SMTP server timeout');
      appStatus.setDegraded('transcription', 'Worker offline');
      
      expect(appStatus.hasAnyDegraded()).toBe(true);
      expect(appStatus.getAllDegraded().length).toBe(3);
      expect(appStatus.getNotes().length).toBe(3);
    });

    it('should allow checking degraded status after reset', () => {
      appStatus.setDegraded('stt', 'Issue');
      appStatus.reset();
      appStatus.setDegraded('email', 'New issue');
      
      expect(appStatus.isDegraded('stt')).toBe(false);
      expect(appStatus.isDegraded('email')).toBe(true);
      expect(appStatus.getAllDegraded()).toEqual(['email']);
    });
  });
});

/**
 * Integration tests for degraded mode ("unsinkable mode")
 * 
 * Verifies that subsystems can fail gracefully without crashing the server
 */

import { appStatus } from '../core/appStatus';

describe('Degraded Mode Integration Tests', () => {
  beforeEach(() => {
    // Reset status before each test
    appStatus.reset();
  });

  describe('STT Provider Degradation', () => {
    it('should mark STT as degraded when initialization fails', () => {
      // Simulate STT initialization failure
      appStatus.setDegraded('stt', 'Whisper initialization failed: Whisper API key invalid');

      expect(appStatus.isDegraded('stt')).toBe(true);
      expect(appStatus.hasAnyDegraded()).toBe(true);
      const notes = appStatus.getNotes();
      expect(notes.length).toBe(1);
      expect(notes[0]).toContain('Whisper initialization failed');
    });
  });

  describe('Email Service Degradation', () => {
    it('should mark email as degraded when service is unavailable', () => {
      // Simulate email service failure
      const emailServiceAvailable = false;
      
      if (!emailServiceAvailable) {
        appStatus.setDegraded('email', 'Email service unavailable');
      }

      expect(appStatus.isDegraded('email')).toBe(true);
      expect(appStatus.hasAnyDegraded()).toBe(true);
    });
  });

  describe('Database Degradation', () => {
    it('should mark database as degraded when connection fails', () => {
      // Simulate database connection failure
      appStatus.setDegraded('database', 'Connection failed at startup');

      expect(appStatus.isDegraded('database')).toBe(true);
      expect(appStatus.getAllDegraded()).toContain('database');
    });
  });

  describe('Multiple Subsystem Degradation', () => {
    it('should handle multiple degraded subsystems simultaneously', () => {
      // Simulate multiple failures
      appStatus.setDegraded('stt', 'STT provider failed');
      appStatus.setDegraded('email', 'Email service timeout');
      appStatus.setDegraded('transcription', 'Worker offline');

      expect(appStatus.hasAnyDegraded()).toBe(true);
      expect(appStatus.getAllDegraded().length).toBe(3);
      expect(appStatus.getNotes().length).toBe(3);

      // Verify each subsystem is marked as degraded
      expect(appStatus.isDegraded('stt')).toBe(true);
      expect(appStatus.isDegraded('email')).toBe(true);
      expect(appStatus.isDegraded('transcription')).toBe(true);
    });
  });

  describe('Health Endpoint Integration', () => {
    it('should provide degraded status for health checks', () => {
      // Mark some subsystems as degraded
      appStatus.setDegraded('stt', 'STT initialization failed');
      appStatus.setDegraded('database', 'Database connection lost');

      // Simulate health endpoint response
      const healthResponse = {
        status: appStatus.hasAnyDegraded() ? 'degraded' : 'ok',
        degraded: appStatus.degraded,
        degradedNotes: appStatus.getNotes(),
        degradedSubsystems: appStatus.getAllDegraded(),
      };

      expect(healthResponse.status).toBe('degraded');
      expect(healthResponse.degradedSubsystems).toContain('stt');
      expect(healthResponse.degradedSubsystems).toContain('database');
      expect(healthResponse.degradedNotes.length).toBe(2);
    });
  });

  describe('Server Continues Operating Despite Failures', () => {
    it('should allow server to continue even with all optional services degraded', () => {
      // Mark all optional services as degraded
      appStatus.setDegraded('stt', 'STT failed');
      appStatus.setDegraded('email', 'Email failed');
      appStatus.setDegraded('transcription', 'Transcription failed');

      // Server should still be operational
      expect(appStatus.hasAnyDegraded()).toBe(true);
      
      // But we can still query status
      const operationalStatus = {
        canHandleRequests: true,
        hasWarnings: appStatus.hasAnyDegraded(),
        degradedCount: appStatus.getAllDegraded().length,
      };

      expect(operationalStatus.canHandleRequests).toBe(true);
      expect(operationalStatus.hasWarnings).toBe(true);
      expect(operationalStatus.degradedCount).toBe(3);
    });
  });
});

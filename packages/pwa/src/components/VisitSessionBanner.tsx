/**
 * Visit Session Banner
 * 
 * Persistent banner showing visit and recording status with quick actions.
 * Displays:
 * - Visit status (active/inactive)
 * - Recording status (recording/idle)
 * - Customer name and visit session info
 * - Quick navigation to visit page
 * 
 * Note: Recording controls remain in VisitApp. This banner is primarily
 * informational with navigation shortcuts.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVisitStore } from '../stores/visitStore';
import './VisitSessionBanner.css';

export const VisitSessionBanner: React.FC = () => {
  const navigate = useNavigate();
  const activeSession = useVisitStore((state) => state.activeSession);
  const activeLead = useVisitStore((state) => state.activeLead);
  const isRecording = useVisitStore((state) => state.isRecording);
  const recordingStartTime = useVisitStore((state) => state.recordingStartTime);
  const transcriptCount = useVisitStore((state) => state.transcriptCount);
  const clearSession = useVisitStore((state) => state.clearSession);

  const [recordingDuration, setRecordingDuration] = useState<string>('0:00');
  const [error, setError] = useState<string | null>(null);

  // Update recording duration every second
  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setRecordingDuration('0:00');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - recordingStartTime.getTime()) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setRecordingDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  const handleEndVisit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSession) return;

    setError(null);

    // End the visit session via API
    try {
      const response = await fetch(`/api/visit-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to end visit session');
      }
      
      clearSession();
      navigate('/visit'); // Navigate back to visit list
    } catch (error) {
      console.error('Failed to end visit:', error);
      setError('Failed to end visit. Please try again from the Visit page.');
      // Don't clear session on error - keep it active
    }
  };

  const handleGoToVisit = () => {
    navigate('/visit');
  };

  // If no active session, don't render the banner
  if (!activeSession) {
    return null;
  }

  const leadName = (activeLead?.firstName || activeLead?.lastName)
    ? `${activeLead.firstName || ''} ${activeLead.lastName || ''}`.trim()
    : 'Unnamed Lead';

  return (
    <div className="visit-session-banner" onClick={handleGoToVisit}>
      <div className="visit-session-info">
        <div className="visit-session-customer">
          <span className="visit-icon">🎙️</span>
          <div className="visit-details">
            <span className="visit-customer-name">{leadName}</span>
            <span className="visit-session-id">Visit Session #{activeSession.id}</span>
          </div>
        </div>
      </div>

      <div className="visit-session-status">
        {/* Recording Status Indicator */}
        {isRecording ? (
          <div className="recording-indicator">
            <span className="recording-pulse">●</span>
            <span className="recording-text">Recording {recordingDuration}</span>
            <span className="recording-count">({transcriptCount} segments)</span>
          </div>
        ) : (
          <span className="visit-status-chip visit-status-active">
            ✓ Visit Active
          </span>
        )}

        {/* Quick Actions */}
        <div className="visit-session-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="visit-action-btn visit-action-end-visit"
            onClick={handleEndVisit}
            title="End Visit Session"
            disabled={isRecording}
          >
            End Visit
          </button>
        </div>
      </div>

      {/* Error message if end visit fails */}
      {error && (
        <div className="visit-error-message" onClick={(e) => e.stopPropagation()}>
          {error}
        </div>
      )}
    </div>
  );
};

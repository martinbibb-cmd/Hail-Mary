/**
 * Visit Session Banner
 * 
 * Persistent banner showing visit and recording status with quick actions.
 * Displays:
 * - Visit status (active/inactive)
 * - Recording status (recording/idle)
 * - Customer name and visit duration
 * - Quick action buttons (stop recording, end visit)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVisitStore } from '../stores/visitStore';
import './VisitSessionBanner.css';

export const VisitSessionBanner: React.FC = () => {
  const navigate = useNavigate();
  const activeSession = useVisitStore((state) => state.activeSession);
  const activeCustomer = useVisitStore((state) => state.activeCustomer);
  const isRecording = useVisitStore((state) => state.isRecording);
  const recordingStartTime = useVisitStore((state) => state.recordingStartTime);
  const transcriptCount = useVisitStore((state) => state.transcriptCount);
  const stopRecording = useVisitStore((state) => state.stopRecording);
  const clearSession = useVisitStore((state) => state.clearSession);

  const [recordingDuration, setRecordingDuration] = useState<string>('0:00');

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

  const handleStopRecording = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopRecording();
  };

  const handleEndVisit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSession) return;

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // End the visit session via API
    try {
      await fetch(`/api/visit-sessions/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          endedAt: new Date(),
        }),
      });
      
      clearSession();
      navigate('/visit'); // Navigate back to visit list
    } catch (error) {
      console.error('Failed to end visit:', error);
    }
  };

  const handleGoToVisit = () => {
    navigate('/visit');
  };

  // If no active session, don't render the banner
  if (!activeSession) {
    return null;
  }

  const customerName = activeCustomer
    ? `${activeCustomer.firstName || ''} ${activeCustomer.lastName || ''}`.trim() || 'Unnamed'
    : 'Unknown Customer';

  return (
    <div className="visit-session-banner" onClick={handleGoToVisit}>
      <div className="visit-session-info">
        <div className="visit-session-customer">
          <span className="visit-icon">🎙️</span>
          <div className="visit-details">
            <span className="visit-customer-name">{customerName}</span>
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
          {isRecording && (
            <button
              className="visit-action-btn visit-action-stop-recording"
              onClick={handleStopRecording}
              title="Stop Recording"
            >
              ⏹️ Stop Recording
            </button>
          )}
          
          <button
            className="visit-action-btn visit-action-end-visit"
            onClick={handleEndVisit}
            title="End Visit"
          >
            End Visit
          </button>
        </div>
      </div>
    </div>
  );
};

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

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVisitStore } from '../stores/visitStore';
import './VisitSessionBanner.css';

export const VisitSessionBanner: React.FC = () => {
  const navigate = useNavigate();
  const activeSession = useVisitStore((state) => state.activeSession);
  const activeLead = useVisitStore((state) => state.activeLead);
  const endVisit = useVisitStore((state) => state.endVisit);
  const isEndingVisit = useVisitStore((state) => state.isEndingVisit);
  const endVisitError = useVisitStore((state) => state.endVisitError);
  const clearEndVisitError = useVisitStore((state) => state.clearEndVisitError);

  // Clear error when session changes
  useEffect(() => {
    return () => clearEndVisitError();
  }, [activeSession, clearEndVisitError]);

  const handleEndVisit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Use global endVisit action from store
    const result = await endVisit();
    
    if (result.success) {
      navigate('/visit'); // Navigate back to visit list
    }
    // Error is handled by the store and displayed via endVisitError
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
        <span className="visit-status-chip visit-status-active">
          ✓ Visit Active
        </span>

        {/* Quick Actions */}
        <div className="visit-session-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="visit-action-btn visit-action-end-visit"
            onClick={handleEndVisit}
            title="End Visit Session"
            disabled={isEndingVisit}
          >
            {isEndingVisit ? 'Ending...' : 'End Visit'}
          </button>
        </div>
      </div>

      {/* Error message if end visit fails */}
      {endVisitError && (
        <div className="visit-error-message" onClick={(e) => e.stopPropagation()}>
          {endVisitError}
        </div>
      )}
    </div>
  );
};

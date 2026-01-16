/**
 * Lead Guard Component
 * 
 * Blocks access to features when no context is available.
 * Checks for EITHER a lead (legacy) OR a spine visit (new workflow).
 * 
 * During the transition, both contexts are supported.
 */

import React from 'react';
import { useLeadStore } from '../stores/leadStore';
import { useVisitStore } from '../stores/visitStore';
import './LeadGuard.css';

interface LeadGuardProps {
  children: React.ReactNode;
  onRequestLead?: () => void;
  message?: string;
  /**
   * If true, requires BOTH lead and visit context (strict mode).
   * If false (default), accepts EITHER lead OR visit context (transition mode).
   */
  requireBoth?: boolean;
}

export const LeadGuard: React.FC<LeadGuardProps> = ({ 
  children, 
  onRequestLead,
  message = 'This feature requires an active context.',
  requireBoth = false,
}) => {
  const currentLeadId = useLeadStore((state) => state.currentLeadId);
  const currentSpineVisitId = useVisitStore((state) => state.currentSpineVisitId);

  // Determine if we have sufficient context (check for both null and undefined)
  const hasContext = requireBoth 
    ? (currentLeadId != null && currentSpineVisitId != null) // Both required
    : (currentLeadId != null || currentSpineVisitId != null); // Either is fine

  if (!hasContext) {
    return (
      <div className="lead-guard-blocker">
        <div className="lead-guard-content">
          <div className="lead-guard-icon">🔒</div>
          <h2 className="lead-guard-title">No Active Context</h2>
          <p className="lead-guard-message">{message}</p>
          <p className="lead-guard-hint">
            {requireBoth 
              ? 'Please select a customer and start a visit.' 
              : 'Please select a customer or start a new visit.'}
          </p>
          {onRequestLead && (
            <button className="lead-guard-button" onClick={onRequestLead}>
              Select Customer
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

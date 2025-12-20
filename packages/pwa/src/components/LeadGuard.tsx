/**
 * Lead Guard Component
 * 
 * Blocks access to lead-dependent features when no lead is selected.
 * Shows a prompt to select a lead and opens the Lead Drawer.
 */

import React from 'react';
import { useLeadStore } from '../stores/leadStore';
import './LeadGuard.css';

interface LeadGuardProps {
  children: React.ReactNode;
  onRequestLead?: () => void;
  message?: string;
}

export const LeadGuard: React.FC<LeadGuardProps> = ({ 
  children, 
  onRequestLead,
  message = 'This feature requires an active lead.'
}) => {
  const currentLeadId = useLeadStore((state) => state.currentLeadId);

  if (!currentLeadId) {
    return (
      <div className="lead-guard-blocker">
        <div className="lead-guard-content">
          <div className="lead-guard-icon">🔒</div>
          <h2 className="lead-guard-title">No Active Lead</h2>
          <p className="lead-guard-message">{message}</p>
          {onRequestLead && (
            <button className="lead-guard-button" onClick={onRequestLead}>
              Select Lead
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

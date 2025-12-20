/**
 * Lead Context Banner
 * 
 * Always-visible banner showing the current lead context.
 * Displays customer name, lead ref, postcode, save status.
 * Clickable to open Lead Drawer for switching leads.
 */

import React from 'react';
import { useLeadStore } from '../stores/leadStore';
import { formatSaveTime, exportLeadAsJsonFile } from '../utils/saveHelpers';
import './LeadContextBanner.css';

interface LeadContextBannerProps {
  onOpenLeadDrawer: () => void;
}

export const LeadContextBanner: React.FC<LeadContextBannerProps> = ({ onOpenLeadDrawer }) => {
  const currentLeadId = useLeadStore((state) => state.currentLeadId);
  const leadById = useLeadStore((state) => state.leadById);
  const dirtyByLeadId = useLeadStore((state) => state.dirtyByLeadId);
  const lastSavedAtByLeadId = useLeadStore((state) => state.lastSavedAtByLeadId);
  const isSyncing = useLeadStore((state) => state.isSyncing);
  const saveFailuresByLeadId = useLeadStore((state) => state.saveFailuresByLeadId);
  const enqueueSave = useLeadStore((state) => state.enqueueSave);
  const exportLeadAsJson = useLeadStore((state) => state.exportLeadAsJson);

  const currentLead = currentLeadId ? leadById[currentLeadId] : null;
  const isDirty = currentLeadId ? dirtyByLeadId[currentLeadId] : false;
  const lastSaved = currentLeadId ? lastSavedAtByLeadId[currentLeadId] : null;
  const failures = currentLeadId ? (saveFailuresByLeadId[currentLeadId] || 0) : 0;

  const handleManualSave = () => {
    if (!currentLead) return;
    enqueueSave({
      leadId: String(currentLead.id),
      reason: 'manual_save',
      payload: currentLead,
    });
  };

  const handleExportJson = () => {
    if (!currentLeadId) return;
    const json = exportLeadAsJson(currentLeadId);
    exportLeadAsJsonFile(currentLeadId, json);
  };

  const getCustomerName = () => {
    if (!currentLead) return '';
    return `${currentLead.firstName || ''} ${currentLead.lastName || ''}`.trim() || 'Unnamed';
  };

  const getPostcode = () => {
    return currentLead?.address?.postcode || '';
  };

  return (
    <div className="lead-context-banner" onClick={currentLead ? onOpenLeadDrawer : undefined}>
      {currentLead ? (
        <>
          <div className="lead-context-info">
            <div className="lead-context-customer">
              <span className="lead-context-name">{getCustomerName()}</span>
              <span className="lead-context-ref">Lead #{currentLead.id}</span>
              {getPostcode() && (
                <span className="lead-context-postcode">{getPostcode()}</span>
              )}
            </div>
          </div>

          <div className="lead-context-status">
            {isSyncing && (
              <span className="lead-status-chip lead-status-syncing">
                ⏳ Syncing...
              </span>
            )}
            
            {!isSyncing && failures >= 3 && (
              <span className="lead-status-chip lead-status-error">
                ⚠️ Save Failed
              </span>
            )}
            
            {!isSyncing && failures < 3 && isDirty && (
              <span className="lead-status-chip lead-status-dirty">
                ● Unsaved
              </span>
            )}
            
            {!isSyncing && failures < 3 && !isDirty && lastSaved && (
              <span className="lead-status-chip lead-status-saved">
                Saved {formatSaveTime(lastSaved)}
              </span>
            )}

            <div className="lead-context-actions" onClick={(e) => e.stopPropagation()}>
              {failures >= 3 && (
                <button 
                  className="lead-action-btn lead-action-export"
                  onClick={handleExportJson}
                  title="Export lead data as JSON"
                >
                  Export JSON
                </button>
              )}
              
              <button 
                className="lead-action-btn lead-action-save"
                onClick={handleManualSave}
                disabled={isSyncing}
                title="Manually save lead"
              >
                Save
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="lead-context-info">
            <div className="lead-context-customer">
              <span className="lead-context-name lead-context-empty">No active lead</span>
              <span className="lead-context-help">Select a lead to start working</span>
            </div>
          </div>

          <div className="lead-context-status">
            <button 
              className="lead-action-btn lead-action-select"
              onClick={onOpenLeadDrawer}
            >
              Select Lead
            </button>
          </div>
        </>
      )}
    </div>
  );
};

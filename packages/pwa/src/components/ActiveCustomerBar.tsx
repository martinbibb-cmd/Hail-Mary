/**
 * Active Customer Bar
 * 
 * Persistent bar at the top of the app showing the currently active customer/lead.
 * Visible on all screens to provide context for all capture actions.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeadStore } from '../stores/leadStore';
import type { Lead } from '@hail-mary/shared';
import './ActiveCustomerBar.css';

export function ActiveCustomerBar() {
  const navigate = useNavigate();
  const leadStore = useLeadStore();
  const currentLeadId = leadStore.currentLeadId;
  const leadById = leadStore.leadById;
  const activeLead = useMemo(() => 
    currentLeadId ? leadById[currentLeadId] : null,
    [currentLeadId, leadById]
  );
  const saveStatus = leadStore.saveStatus;
  const setActiveLead = leadStore.setCurrentLead;
  const clearActiveLead = leadStore.clearCurrentLead;
  const [showSelector, setShowSelector] = useState(false);

  // Get save status indicator
  const getSaveStatusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return <span className="save-status saving">⏳ Saving...</span>;
      case 'saved':
        return <span className="save-status saved">✓ Saved</span>;
      case 'error':
        return <span className="save-status error">⚠️ Error</span>;
      default:
        return null;
    }
  };

  const handleChange = () => {
    setShowSelector(true);
  };

  const handleClear = () => {
    if (window.confirm('Clear active customer? Any unsaved work may be lost.')) {
      clearActiveLead();
    }
  };

  const handleSelectLead = (lead: Lead) => {
    setActiveLead(lead);
    navigate('/');
    setShowSelector(false);
  };

  return (
    <>
      <div className="active-customer-bar">
        {activeLead ? (
          <>
            <div className="active-customer-info">
              <div className="customer-label">Active Lead:</div>
              <div className="customer-details">
                <span className="customer-name">
                  {activeLead.firstName} {activeLead.lastName}
                </span>
                {activeLead.address?.line1 && (
                  <span className="customer-address">
                    {activeLead.address.line1}, {activeLead.address.postcode}
                  </span>
                )}
                {!activeLead.address?.line1 && (
                  <span className="customer-ref">Lead #{activeLead.id}</span>
                )}
              </div>
            </div>
            <div className="active-customer-actions">
              {getSaveStatusIndicator()}
              <button className="btn-change" onClick={handleChange}>
                Change
              </button>
              <button className="btn-clear" onClick={handleClear}>
                Clear
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="active-customer-info">
              <div className="customer-label warning">⚠️ No Active Lead</div>
              <div className="customer-details">
                <span className="customer-prompt">
                  Select a lead to start capturing data
                </span>
              </div>
            </div>
            <div className="active-customer-actions">
              <button className="btn-change primary" onClick={handleChange}>
                Select Lead
              </button>
            </div>
          </>
        )}
      </div>

      {showSelector && (
        <CustomerSelectorModal
          onSelect={handleSelectLead}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}

interface CustomerSelectorModalProps {
  onSelect: (lead: Lead) => void;
  onClose: () => void;
}

function CustomerSelectorModal({ onSelect, onClose }: CustomerSelectorModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch leads from API
    fetch('/api/leads?limit=100', { credentials: 'include' })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setLeads(result.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredLeads = leads.filter(lead => {
    const query = searchQuery.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(query) ||
      lead.lastName.toLowerCase().includes(query) ||
      (lead.address?.postcode && lead.address.postcode.toLowerCase().includes(query)) ||
      String(lead.id).includes(query)
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content customer-selector" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select Active Customer</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, postcode, or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          {loading ? (
            <div className="loading-state">Loading customers...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? 'No customers match your search' : 'No customers found'}
            </div>
          ) : (
            <div className="customer-list">
              {filteredLeads.map(lead => (
                <div
                  key={lead.id}
                  className="customer-item"
                  onClick={() => onSelect(lead)}
                >
                  <div className="customer-item-name">
                    {lead.firstName || 'Unknown'} {lead.lastName || ''}
                  </div>
                  <div className="customer-item-details">
                    {lead.address?.line1 ? (
                      <>
                        {lead.address.line1}, {lead.address.postcode}
                      </>
                    ) : (
                      <>Lead #{lead.id}</>
                    )}
                  </div>
                  <div className="customer-item-status">
                    Status: {lead.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Lead Drawer
 * 
 * Drawer panel for switching leads, creating new leads, and viewing lead summary.
 * Opens from clicking the Lead Context Banner or from "More" drawer.
 */

import React, { useState, useEffect } from 'react';
import { useLeadStore } from '../stores/leadStore';
import type { Lead, PaginatedResponse } from '@hail-mary/shared';
import './LeadDrawer.css';

interface LeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeadDrawer: React.FC<LeadDrawerProps> = ({ isOpen, onClose }) => {
  const currentLeadId = useLeadStore((state) => state.currentLeadId);
  const leadById = useLeadStore((state) => state.leadById);
  const setCurrentLead = useLeadStore((state) => state.setCurrentLead);
  const exportLeadAsJson = useLeadStore((state) => state.exportLeadAsJson);
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const currentLead = currentLeadId ? leadById[currentLeadId] : null;

  useEffect(() => {
    if (isOpen) {
      loadLeads();
    }
  }, [isOpen]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leads?limit=100', {
        credentials: 'include',
      });
      const result: PaginatedResponse<Lead> = await response.json();
      if (result.success && result.data) {
        setLeads(result.data);
      }
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchLead = (lead: Lead) => {
    setCurrentLead(lead);
    onClose();
  };

  const handleExportCurrent = () => {
    if (!currentLeadId) return;
    const json = exportLeadAsJson(currentLeadId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-${currentLeadId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.firstName?.toLowerCase().includes(query) ||
      lead.lastName?.toLowerCase().includes(query) ||
      lead.address?.postcode?.toLowerCase().includes(query) ||
      String(lead.id).includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="lead-drawer-overlay" onClick={onClose} />
      <div className="lead-drawer">
        <div className="lead-drawer-header">
          <h2>Lead Selector</h2>
          <button className="lead-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="lead-drawer-body">
          {/* Current Lead Summary */}
          {currentLead && (
            <div className="lead-drawer-current">
              <h3>Current Lead</h3>
              <div className="lead-summary-card">
                <div className="lead-summary-info">
                  <div className="lead-summary-name">
                    {currentLead.firstName} {currentLead.lastName}
                  </div>
                  <div className="lead-summary-details">
                    {currentLead.address?.line1 && (
                      <div>{currentLead.address.line1}</div>
                    )}
                    {currentLead.address?.postcode && (
                      <div>{currentLead.address.postcode}</div>
                    )}
                    <div className="lead-summary-meta">
                      Status: {currentLead.status} • Lead #{currentLead.id}
                    </div>
                  </div>
                </div>
                <button
                  className="lead-summary-export-btn"
                  onClick={handleExportCurrent}
                  title="Export current lead as JSON"
                >
                  📥 Export
                </button>
              </div>
            </div>
          )}

          {/* Search & List */}
          <div className="lead-drawer-search">
            <input
              type="text"
              placeholder="Search by name, postcode, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="lead-search-input"
            />
          </div>

          {/* Create Lead Button */}
          <div className="lead-drawer-actions">
            <button
              className="lead-create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              + New Lead
            </button>
          </div>

          {/* Leads List */}
          <div className="lead-drawer-list">
            {loading ? (
              <div className="lead-drawer-loading">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="lead-drawer-empty">
                {searchQuery ? 'No leads match your search' : 'No leads found'}
              </div>
            ) : (
              filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`lead-list-item ${currentLeadId === String(lead.id) ? 'lead-list-item-active' : ''}`}
                  onClick={() => handleSwitchLead(lead)}
                >
                  <div className="lead-list-info">
                    <div className="lead-list-name">
                      {lead.firstName || 'Unknown'} {lead.lastName || ''}
                    </div>
                    <div className="lead-list-details">
                      {lead.address?.line1 ? (
                        <>
                          {lead.address.line1}, {lead.address.postcode}
                        </>
                      ) : (
                        <>Lead #{lead.id}</>
                      )}
                    </div>
                  </div>
                  <div className="lead-list-status">
                    {lead.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Lead Form (overlay) */}
        {showCreateForm && (
          <CreateLeadForm
            onClose={() => setShowCreateForm(false)}
            onCreated={(newLead) => {
              setShowCreateForm(false);
              setCurrentLead(newLead);
              onClose();
            }}
          />
        )}
      </div>
    </>
  );
};

interface CreateLeadFormProps {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

const CreateLeadForm: React.FC<CreateLeadFormProps> = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'website',
    status: 'new' as const,
    description: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      postcode: '',
      country: 'UK',
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success && result.data) {
        onCreated(result.data);
      } else {
        setError(result.error || 'Failed to create lead');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-lead-overlay">
      <div className="create-lead-form">
        <div className="create-lead-header">
          <h3>Create New Lead</h3>
          <button onClick={onClose} className="create-lead-close">✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="create-lead-error">{error}</div>}
          
          <div className="create-lead-row">
            <label>First Name *</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>

          <div className="create-lead-row">
            <label>Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>

          <div className="create-lead-row">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="create-lead-row">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="create-lead-row">
            <label>Postcode</label>
            <input
              type="text"
              value={formData.address.postcode}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, postcode: e.target.value }
              })}
            />
          </div>

          <div className="create-lead-row">
            <label>Address</label>
            <input
              type="text"
              placeholder="Street address"
              value={formData.address.line1}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, line1: e.target.value }
              })}
            />
          </div>

          <div className="create-lead-row">
            <label>City</label>
            <input
              type="text"
              value={formData.address.city}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, city: e.target.value }
              })}
            />
          </div>

          <div className="create-lead-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-create">
              {submitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

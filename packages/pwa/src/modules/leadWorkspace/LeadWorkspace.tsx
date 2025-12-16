/**
 * Lead Workspace Component
 * 
 * Main workspace for viewing and editing all lead-related data
 * Uses tabs to organize different aspects of the lead
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { LeadWorkspace as LeadWorkspaceType, ApiResponse } from '@hail-mary/shared';
import { CustomerTab } from './tabs/CustomerTab';
import { OccupancyTab } from './tabs/OccupancyTab';
import { PropertyTab } from './tabs/PropertyTab';
import { InterestsTab } from './tabs/InterestsTab';
import { QuotesTab } from './tabs/QuotesTab';
import { RecommendationsTab } from './tabs/RecommendationsTab';
import './LeadWorkspace.css';

type TabType = 'customer' | 'occupancy' | 'property' | 'interests' | 'quotes' | 'recommendations';

export function LeadWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<LeadWorkspaceType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('customer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspace();
  }, [id]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leads/${id}/workspace`, {
        credentials: 'include',
      });
      const data: ApiResponse<LeadWorkspaceType> = await res.json();
      
      if (data.success && data.data) {
        setWorkspace(data.data);
      } else {
        setError(data.error || 'Failed to load workspace');
      }
    } catch (err) {
      setError('Failed to load workspace');
      console.error('Error loading workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="workspace-loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="workspace-error">
        <h2>Error</h2>
        <p>{error || 'Workspace not found'}</p>
        <Link to="/leads" className="btn-secondary">← Back to Leads</Link>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'customer', label: 'Customer' },
    { id: 'occupancy', label: 'Occupancy' },
    { id: 'property', label: 'Property' },
    { id: 'interests', label: 'Interests' },
    { id: 'quotes', label: 'Quotes' },
    { id: 'recommendations', label: 'Recommendations' },
  ];

  return (
    <div className="lead-workspace">
      <div className="workspace-header">
        <div>
          <Link to="/leads" className="back-link">← Back to Leads</Link>
          <h1>{workspace.lead.firstName} {workspace.lead.lastName}</h1>
          <p className="lead-status">Status: {workspace.lead.status}</p>
        </div>
      </div>

      <div className="workspace-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="workspace-content">
        {activeTab === 'customer' && (
          <CustomerTab 
            leadId={Number(id)} 
            contact={workspace.contact} 
            onUpdate={loadWorkspace}
          />
        )}
        {activeTab === 'occupancy' && (
          <OccupancyTab 
            leadId={Number(id)} 
            occupancy={workspace.occupancy} 
            onUpdate={loadWorkspace}
          />
        )}
        {activeTab === 'property' && (
          <PropertyTab 
            leadId={Number(id)} 
            property={workspace.property} 
            onUpdate={loadWorkspace}
          />
        )}
        {activeTab === 'interests' && (
          <InterestsTab 
            leadId={Number(id)} 
            interests={workspace.interests}
            futurePlans={workspace.futurePlans}
            technologies={workspace.technologies}
            onUpdate={loadWorkspace}
          />
        )}
        {activeTab === 'quotes' && (
          <QuotesTab 
            leadId={Number(id)} 
            quotes={workspace.quotes}
            onUpdate={loadWorkspace}
          />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab 
            leadId={Number(id)} 
            recommendations={workspace.recommendations}
            onUpdate={loadWorkspace}
          />
        )}
      </div>
    </div>
  );
}

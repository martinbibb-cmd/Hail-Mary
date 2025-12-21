/**
 * Admin System Recommendation Page
 * 
 * Provides management interface for the System Recommendation submodule:
 * - View submodule information
 * - Initialize/update the submodule
 * - Access to the System Recommendation tool
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './AdminSystemRecommendationPage.css';

export const AdminSystemRecommendationPage: React.FC = () => {
  const [updating, setUpdating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; output?: string } | null>(null);

  const handleInitializeSubmodule = async () => {
    if (!confirm('This will initialize the System Recommendation submodule. Continue?')) {
      return;
    }

    setInitializing(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/system-recommendation/initialize', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setResult({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
      } else if (data.success) {
        setResult({
          success: true,
          message: data.message || 'Submodule initialized successfully',
          output: data.output || '',
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to initialize submodule',
          output: data.output || data.details || '',
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: 'Failed to initialize submodule. Backend endpoint may not be available yet.',
      });
      console.error('Error initializing submodule:', err);
    } finally {
      setInitializing(false);
    }
  };

  const handleUpdateSubmodule = async () => {
    if (!confirm('This will update the System Recommendation submodule to the latest version. Continue?')) {
      return;
    }

    setUpdating(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/system-recommendation/update', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setResult({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
      } else if (data.success) {
        setResult({
          success: true,
          message: data.message || 'Submodule updated successfully',
          output: data.output || '',
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to update submodule',
          output: data.output || data.details || '',
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: 'Failed to update submodule. Backend endpoint may not be available yet.',
      });
      console.error('Error updating submodule:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>🔥 System Recommendation</h1>
          <Link to="/" className="btn-secondary">← Back to Dashboard</Link>
        </div>

        <p className="page-subtitle">Manage the System Recommendation submodule for heating system analysis.</p>

        <div className="info-section">
          <h2>About System Recommendation</h2>
          <p className="section-description">
            The System Recommendation tool helps determine the best heating system for a property based on 
            various factors including property type, occupancy, bathrooms, current system, and gas connection availability.
          </p>
          <div className="info-card">
            <div className="info-item">
              <span className="info-label">Repository:</span>
              <span className="info-value">
                <a 
                  href="https://github.com/martinbibb-cmd/System-recommendation" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  martinbibb-cmd/System-recommendation ↗
                </a>
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Submodule Path:</span>
              <span className="info-value">system-recommendation/</span>
            </div>
            <div className="info-item">
              <span className="info-label">Engine Version:</span>
              <span className="info-value">1.0.0</span>
            </div>
          </div>
        </div>

        {result && (
          <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}>
            {result.message}
          </div>
        )}

        <div className="actions-section">
          <h2>Submodule Management</h2>
          <p className="section-description">
            Use these actions to manage the System Recommendation submodule. Initialize sets up the submodule 
            for the first time, and update pulls the latest changes from the repository.
          </p>

          <div className="actions-grid">
            <button
              className="btn-primary btn-action"
              onClick={handleInitializeSubmodule}
              disabled={initializing || updating}
            >
              {initializing ? '🔄 Initializing...' : '🚀 Initialize Submodule'}
            </button>

            <button
              className="btn-primary btn-action"
              onClick={handleUpdateSubmodule}
              disabled={updating || initializing}
            >
              {updating ? '🔄 Updating...' : '⬆️ Update Submodule'}
            </button>
          </div>

          {result?.output && (
            <div className="output-section">
              <h3>Command Output</h3>
              <pre className="output-display">{result.output}</pre>
            </div>
          )}
        </div>

        <div className="info-section">
          <h2>Integration Status</h2>
          <p className="section-description">
            The System Recommendation engine is currently integrated into the Hail-Mary application 
            through the shared package. This submodule provides the core recommendation logic.
          </p>
          <div className="status-grid">
            <div className="status-card">
              <h3>✅ Engine Integration</h3>
              <p className="status-text">Core recommendation logic is available in @hail-mary/shared package</p>
            </div>
            <div className="status-card">
              <h3>✅ API Endpoints</h3>
              <p className="status-text">POST /api/v1/leads/:leadId/system-recommendation</p>
            </div>
            <div className="status-card">
              <h3>✅ Database Schema</h3>
              <p className="status-text">lead_system_recommendations table with JSONB storage</p>
            </div>
          </div>
        </div>

        <div className="alert alert-info">
          <strong>ℹ️ Note:</strong> The submodule has been added to this repository at the root level. 
          To use it locally, you may need to run <code>git submodule update --init --recursive</code> 
          after pulling these changes.
        </div>
      </div>
    </div>
  );
};

export default AdminSystemRecommendationPage;

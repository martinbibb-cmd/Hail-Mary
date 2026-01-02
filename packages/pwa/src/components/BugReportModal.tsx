/**
 * Bug Report Modal
 *
 * Modal for submitting bug reports and feature requests.
 * Automatically captures context like URL, screen resolution, and user agent.
 */

import React, { useState } from 'react';
import { apiFetch } from '../services/apiClient';
import './BugReportModal.css';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bugType, setBugType] = useState<'bug' | 'feature' | 'improvement' | 'question'>('bug');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setSubmitError('Title and description are required');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Capture context automatically
      const contextData = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timestamp: new Date().toISOString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };

      const response = await apiFetch<{ success: boolean; error?: string }>('/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          bugType,
          priority,
          url: contextData.url,
          userAgent: contextData.userAgent,
          screenResolution: contextData.screenResolution,
          contextData,
        }),
      });

      if (response.success) {
        setSubmitSuccess(true);
        setTitle('');
        setDescription('');
        setBugType('bug');
        setPriority('medium');

        // Close modal after 2 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
          onClose();
        }, 2000);
      } else {
        setSubmitError(response.error || 'Failed to submit bug report');
      }
    } catch (error) {
      console.error('Error submitting bug report:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle('');
      setDescription('');
      setBugType('bug');
      setPriority('medium');
      setSubmitError(null);
      setSubmitSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="bug-report-modal-overlay" onClick={handleClose} />
      <div className="bug-report-modal">
        <div className="bug-report-modal-header">
          <h2>🐛 Report a Bug or Request a Feature</h2>
          <button
            className="bug-report-modal-close"
            onClick={handleClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="bug-report-modal-body">
          {submitSuccess ? (
            <div className="bug-report-success">
              <div className="bug-report-success-icon">✅</div>
              <h3>Thank you!</h3>
              <p>Your report has been submitted successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="bug-report-form-group">
                <label htmlFor="bug-type">Type</label>
                <select
                  id="bug-type"
                  value={bugType}
                  onChange={(e) => setBugType(e.target.value as any)}
                  disabled={isSubmitting}
                >
                  <option value="bug">🐛 Bug</option>
                  <option value="feature">✨ Feature Request</option>
                  <option value="improvement">🔧 Improvement</option>
                  <option value="question">❓ Question</option>
                </select>
              </div>

              <div className="bug-report-form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  disabled={isSubmitting}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">🔴 Critical</option>
                </select>
              </div>

              <div className="bug-report-form-group">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue or request"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="bug-report-form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What were you trying to do? What did you expect to happen?"
                  rows={6}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="bug-report-context-info">
                <small>
                  <strong>Context captured automatically:</strong>
                  <br />
                  📍 Current page: {window.location.pathname}
                  <br />
                  📱 Screen: {window.screen.width}x{window.screen.height}
                </small>
              </div>

              {submitError && (
                <div className="bug-report-error">
                  {submitError}
                </div>
              )}

              <div className="bug-report-modal-footer">
                <button
                  type="button"
                  className="bug-report-btn bug-report-btn-secondary"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bug-report-btn bug-report-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

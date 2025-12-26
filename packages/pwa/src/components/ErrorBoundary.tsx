/**
 * Error Boundary Component
 * 
 * Catches unhandled errors in the React component tree
 * and displays a recovery UI with option to clear localStorage
 * and reload the app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleClearAndReload = () => {
    try {
      // Clear problematic localStorage items
      localStorage.removeItem('dockItems');
      console.log('[ErrorBoundary] Cleared dockItems from localStorage');
    } catch (error) {
      console.error('[ErrorBoundary] Failed to clear localStorage', error);
    }
    
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>⚠️ Something went wrong</h1>
            <p className="error-boundary-message">
              The app encountered an unexpected error. This might be due to corrupted local data.
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error details</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}
            <div className="error-boundary-actions">
              <button 
                className="error-boundary-btn error-boundary-btn-primary"
                onClick={this.handleClearAndReload}
              >
                Clear Data & Reload
              </button>
              <button 
                className="error-boundary-btn error-boundary-btn-secondary"
                onClick={() => window.location.reload()}
              >
                Just Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

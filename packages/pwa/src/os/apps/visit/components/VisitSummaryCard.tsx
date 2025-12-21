/**
 * Visit Summary Card Component
 * 
 * Displays AI-generated summary of the visit session.
 * Shows summary text and provides button to regenerate.
 */

import React from 'react'
import './VisitSummaryCard.css'

export interface VisitSummaryCardProps {
  summary?: string
  isGenerating?: boolean
  onGenerate: () => void
}

export const VisitSummaryCard: React.FC<VisitSummaryCardProps> = ({
  summary,
  isGenerating = false,
  onGenerate,
}) => {
  return (
    <div className="visit-summary-card">
      <div className="visit-summary-header">
        <h3>📝 Visit Summary</h3>
        <button 
          className="btn-generate-summary"
          onClick={onGenerate}
          disabled={isGenerating}
          title="Generate or regenerate visit summary"
        >
          {isGenerating ? '⏳ Generating...' : '🔄 Generate Summary'}
        </button>
      </div>
      
      <div className="visit-summary-content">
        {summary ? (
          <div className="visit-summary-text">
            {summary.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div className="visit-summary-empty">
            <p>No summary generated yet.</p>
            <p className="visit-summary-hint">
              Click "Generate Summary" to create an AI-powered summary of this visit.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

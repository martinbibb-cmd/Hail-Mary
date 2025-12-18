import React, { useState } from 'react'
import type { RockyProcessResult } from '@hail-mary/shared'

/**
 * Rocky Tool Page
 * 
 * UI for Rocky's deterministic fact extraction.
 * Shows facts, bullets, and provides "copy engineer notes" functionality.
 */
export const RockyTool: React.FC = () => {
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<RockyProcessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProcess = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rocky/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transcript,
        }),
      })

      const data = await response.json()

      if (data.success && data.data) {
        setResult(data.data)
      } else {
        setError(data.error || 'Failed to process transcript')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process transcript')
    } finally {
      setLoading(false)
    }
  }

  const copyEngineerBasics = async () => {
    if (!result?.engineerBasics) return

    const basics = result.engineerBasics.basics
    const text = `
Property: ${basics.propertyType || 'N/A'} (${basics.bedrooms || 'N/A'} bed)
Boiler: ${basics.boilerMakeModel || 'N/A'} (${basics.boilerAge || 'N/A'} years)
System: ${basics.systemType || 'N/A'}
Pipe: ${basics.pipeSize || 'N/A'}
Fuse: ${basics.mainFuse || 'N/A'}A

Materials:
${basics.materials.map(m => `- ${m}`).join('\n')}

Hazards:
${basics.hazards.map(h => `- ${h}`).join('\n')}

Actions:
${basics.actions.map(a => `- ${a}`).join('\n')}
    `.trim()

    try {
      await navigator.clipboard.writeText(text)
      alert('Engineer basics copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      alert('Failed to copy to clipboard. Please try again.')
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🪨 Rocky - Fact Extraction Tool</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Rocky analyzes voice transcripts and extracts structured facts using deterministic rules.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Transcript or Notes:
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Enter survey transcript or natural notes here..."
          rows={8}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontFamily: 'monospace',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <button
        onClick={handleProcess}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: loading ? '#999' : '#007bff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
        }}
      >
        {loading ? 'Processing...' : 'Run Rocky'}
      </button>

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2>Results</h2>
            <button
              onClick={copyEngineerBasics}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              📋 Copy Engineer Basics
            </button>
          </div>

          {/* Completeness Scores */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Completeness</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Overall</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.rockyFacts.completeness.overall}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Customer Info</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.rockyFacts.completeness.customerInfo}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Property</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.rockyFacts.completeness.propertyDetails}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>System</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.rockyFacts.completeness.existingSystem}%</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666' }}>Measurements</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.rockyFacts.completeness.measurements}%</div>
              </div>
            </div>
          </div>

          {/* Automatic Notes */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Automatic Notes</h3>
            <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
              {Object.entries(result.automaticNotes.sections).map(([key, value]) => (
                <div key={key} style={{ marginBottom: '16px' }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#333' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </strong>
                  <div style={{ color: '#666', paddingLeft: '12px' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Data */}
          {result.rockyFacts.missingData.length > 0 && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Missing Data</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.rockyFacts.missingData.map((item, idx) => (
                  <li key={idx}>
                    {item.category}.{item.field} {item.required && <strong>(Required)</strong>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Warnings</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {result.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

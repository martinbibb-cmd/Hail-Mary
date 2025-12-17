import React, { useState } from 'react'
import type { SarahProcessResult, SarahAudience, SarahTone } from '@hail-mary/shared'

/**
 * Sarah Tool Page
 * 
 * UI for Sarah's explanation generation.
 * Shows human explanation and "what we still need" based on Rocky's output.
 */
export const SarahTool: React.FC = () => {
  const [rockyOutput, setRockyOutput] = useState('')
  const [audience, setAudience] = useState<SarahAudience>('customer')
  const [tone, setTone] = useState<SarahTone>('professional')
  const [result, setResult] = useState<SarahProcessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExplain = async () => {
    if (!rockyOutput.trim()) {
      setError('Please enter Rocky output (JSON)')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Parse Rocky output
      const rockyFacts = JSON.parse(rockyOutput)

      const response = await fetch('/api/sarah/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rockyFacts,
          audience,
          tone,
        }),
      })

      const data = await response.json()

      if (data.success && data.data) {
        setResult(data.data)
      } else {
        setError(data.error || 'Failed to generate explanation')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🧠 Sarah - Explanation Generator</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Sarah generates human-readable explanations from Rocky's structured facts.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Rocky Output (JSON):
        </label>
        <textarea
          value={rockyOutput}
          onChange={(e) => setRockyOutput(e.target.value)}
          placeholder='Paste Rocky JSON output here (e.g., result.rockyFacts from Rocky tool)'
          rows={8}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Audience:
          </label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as SarahAudience)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="customer">Customer</option>
            <option value="engineer">Engineer</option>
            <option value="surveyor">Surveyor</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Tone:
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as SarahTone)}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="technical">Technical</option>
            <option value="simple">Simple</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleExplain}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: loading ? '#999' : '#28a745',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
        }}
      >
        {loading ? 'Generating...' : 'Generate Explanation'}
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
          <h2>Explanation</h2>

          <div
            style={{
              padding: '16px',
              backgroundColor: '#e8f4f8',
              borderLeft: '4px solid #17a2b8',
              borderRadius: '4px',
              marginBottom: '12px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              Audience: <strong>{result.explanation.audience}</strong> | 
              Tone: <strong>{result.explanation.tone}</strong>
            </div>
          </div>

          {/* Explanation Sections */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {Object.entries(result.explanation.sections).map(([key, value]) => {
                if (!value) return null
                return (
                  <div key={key} style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#333' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </h3>
                    <div style={{ color: '#555' }}>{value}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Context */}
          {result.explanation.context && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Context</h3>
              {result.explanation.context.whyItMatters && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>Why it matters:</strong>
                  <div>{result.explanation.context.whyItMatters}</div>
                </div>
              )}
              {result.explanation.context.whatToExpect && (
                <div style={{ marginBottom: '12px' }}>
                  <strong>What to expect:</strong>
                  <div>{result.explanation.context.whatToExpect}</div>
                </div>
              )}
              {result.explanation.context.commonQuestions && result.explanation.context.commonQuestions.length > 0 && (
                <div>
                  <strong>Common questions:</strong>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    {result.explanation.context.commonQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              fontSize: '13px',
              fontStyle: 'italic',
            }}
          >
            {result.explanation.disclaimer}
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import type { RockyProcessResult } from '@hail-mary/shared'
import { aiService } from '../../services/ai.service'
import { useAuth } from '../../auth'
import { safeCopyToClipboard } from '../../utils/clipboard'

interface DebugInfo {
  requestUrl: string
  responseStatus: number | null
  responseBody: string
  timestamp: Date
}

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
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'available' | 'degraded' | 'unavailable'>('checking')
  const [lastError, setLastError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [smokeTestRunning, setSmokeTestRunning] = useState(false)
  const [smokeTestSuccess, setSmokeTestSuccess] = useState<string | null>(null)
  const { logout } = useAuth()

  // Check Worker health on mount
  useEffect(() => {
    const checkHealth = async () => {
      const health = await aiService.checkHealth()
      setWorkerStatus(health.status)
    }
    checkHealth()
  }, [])

  const runSmokeTest = async () => {
    setSmokeTestRunning(true)
    setError(null)
    setLastError(null)
    setSmokeTestSuccess(null)

    const testRequest = {
      transcript: 'Test survey: customer has a Worcester boiler in a 3 bedroom house',
      mode: 'extract',
    }

    const requestUrl = '/api/rocky/run'
    
    try {
      const startTime = Date.now()
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testRequest),
      })
      const responseTime = Date.now() - startTime
      
      const data = await response.json()
      const bodyPreview = JSON.stringify(data).substring(0, 300)
      
      setDebugInfo({
        requestUrl,
        responseStatus: response.status,
        responseBody: bodyPreview,
        timestamp: new Date(),
      })

      // Auth expired: quietly drop back to AuthScreen
      if (response.status === 401) {
        await logout()
        return
      }

      // Rate limited / already running: show calm inline message (no red panic)
      if (response.status === 429) {
        setWorkerStatus('available')
        setLastError('RATE_LIMITED')
        setError('Rocky is already running — please wait a moment')
        return
      }
      
      if (response.ok && data.success) {
        setWorkerStatus('available')
        setLastError(null)
        setSmokeTestSuccess(`Smoke test passed! Status: ${response.status}, Response time: ${responseTime}ms`)
      } else {
        setWorkerStatus('degraded')
        setLastError(`HTTP ${response.status}: ${data.error || 'Unknown error'}`)
        setError(`Smoke test failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      setWorkerStatus('unavailable')
      setLastError(errorMsg)
      setError(`Smoke test failed: ${errorMsg}`)
      setDebugInfo({
        requestUrl,
        responseStatus: null,
        responseBody: errorMsg,
        timestamp: new Date(),
      })
    } finally {
      setSmokeTestRunning(false)
    }
  }

  const handleProcess = async () => {
    if (!transcript.trim()) {
      setError('Please enter a transcript')
      return
    }

    setLoading(true)
    setError(null)
    setLastError(null)
    
    const requestUrl = '/api/rocky/run'

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transcript,
          mode: 'extract',
        }),
      })
      
      const data = await response.json()
      const bodyPreview = JSON.stringify(data).substring(0, 300)
      
      setDebugInfo({
        requestUrl,
        responseStatus: response.status,
        responseBody: bodyPreview,
        timestamp: new Date(),
      })

      // Auth expired: quietly drop back to AuthScreen
      if (response.status === 401) {
        await logout()
        return
      }

      // Rate limited / already running: show calm inline message (no red panic)
      if (response.status === 429) {
        setWorkerStatus('available')
        setLastError('RATE_LIMITED')
        setError('Rocky is already running — please wait a moment')
        return
      }

      if (data.success && data.data) {
        setResult(data.data)
        setWorkerStatus('available')
        setLastError(null)
      } else {
        const errorMsg = data.error || 'Failed to process transcript'
        setError(errorMsg)
        setLastError(`HTTP ${response.status}: ${errorMsg}`)
        setWorkerStatus('degraded')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process transcript'
      setError(errorMsg)
      setLastError(errorMsg)
      setWorkerStatus('unavailable')
      setDebugInfo({
        requestUrl,
        responseStatus: null,
        responseBody: errorMsg,
        timestamp: new Date(),
      })
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

    const copyResult = await safeCopyToClipboard(text)
    if (copyResult.ok) {
      alert('Engineer basics copied to clipboard!')
    } else {
      console.error('Failed to copy to clipboard:', copyResult.error)
      alert(`Failed to copy to clipboard: ${copyResult.error}`)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h1 style={{ margin: 0 }}>🪨 Rocky - Fact Extraction Tool</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={runSmokeTest}
            disabled={smokeTestRunning}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: smokeTestRunning ? '#999' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: smokeTestRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {smokeTestRunning ? '⏳ Testing...' : '🔬 Smoke Test'}
          </button>
          <div style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 'bold',
            backgroundColor: workerStatus === 'available' ? '#d4edda' : workerStatus === 'degraded' ? '#fff3cd' : workerStatus === 'unavailable' ? '#f8d7da' : '#e7e7e7',
            color: workerStatus === 'available' ? '#155724' : workerStatus === 'degraded' ? '#856404' : workerStatus === 'unavailable' ? '#721c24' : '#666',
          }}>
            {workerStatus === 'available' ? '✓ Available' : workerStatus === 'degraded' ? '⚠ Degraded' : workerStatus === 'unavailable' ? '✗ Unavailable' : '⏳ Checking...'}
          </div>
        </div>
      </div>
      
      {/* Status Panel */}
      <div style={{
        padding: '12px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        marginBottom: '12px',
        fontSize: '13px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <strong>Service Status</strong>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              backgroundColor: 'transparent',
              color: '#007bff',
              border: '1px solid #007bff',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {showDebug ? '▼ Hide Debug' : '▶ Show Debug'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 12px', fontSize: '12px' }}>
          <span style={{ color: '#666' }}>Endpoint:</span>
          <code style={{ fontSize: '11px' }}>/api/rocky/run</code>
          <span style={{ color: '#666' }}>Auth:</span>
          <span>✓ Session cookies (credentials: include)</span>
          {lastError && (
            <>
              <span style={{ color: lastError === 'RATE_LIMITED' ? '#856404' : '#d9534f' }}>Last Error:</span>
              <span style={{ color: lastError === 'RATE_LIMITED' ? '#856404' : '#d9534f', fontSize: '11px' }}>{lastError}</span>
            </>
          )}
        </div>
        
        {showDebug && debugInfo && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}>
            <div><strong>Debug Info:</strong></div>
            <div>Request URL: {debugInfo.requestUrl}</div>
            <div>Response Status: {debugInfo.responseStatus || 'N/A'}</div>
            <div>Response Body (first 300 chars): {debugInfo.responseBody}</div>
            <div>Timestamp: {debugInfo.timestamp.toLocaleTimeString()}</div>
          </div>
        )}
      </div>

      {smokeTestSuccess && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
            color: '#155724',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {smokeTestSuccess}</span>
          <button
            onClick={() => setSmokeTestSuccess(null)}
            style={{
              padding: '2px 8px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color: '#155724',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

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
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeeba',
            borderRadius: '4px',
            color: '#856404',
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

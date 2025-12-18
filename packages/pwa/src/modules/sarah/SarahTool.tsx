import React, { useState, useEffect, useRef } from 'react'
import type { SarahProcessResult, SarahAudience, SarahTone } from '@hail-mary/shared'
import { aiService } from '../../services/ai.service'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * Sarah Tool Page
 * 
 * UI for Sarah's explanation generation with chat interface.
 * Shows human explanation and "what we still need" based on Rocky's output.
 */
export const SarahTool: React.FC = () => {
  const [mode, setMode] = useState<'form' | 'chat'>('form')
  const [rockyOutput, setRockyOutput] = useState('')
  const [audience, setAudience] = useState<SarahAudience>('customer')
  const [tone, setTone] = useState<SarahTone>('professional')
  const [result, setResult] = useState<SarahProcessResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workerStatus, setWorkerStatus] = useState<'checking' | 'available' | 'degraded' | 'unavailable'>('checking')
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Check Worker health on mount
  useEffect(() => {
    const checkHealth = async () => {
      const health = await aiService.checkHealth()
      setWorkerStatus(health.status)
    }
    checkHealth()
  }, [])

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

      // Use AI service which calls the gateway
      const data = await aiService.callSarah({
        rockyFacts,
        audience,
        tone,
      })

      if (data.success && data.data) {
        setResult(data.data)
        setWorkerStatus('available')
      } else {
        setError(data.error || 'Failed to generate explanation')
        setWorkerStatus('degraded')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation')
      setWorkerStatus('unavailable')
    } finally {
      setLoading(false)
    }
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setChatInput('')
    setLoading(true)
    setError(null)

    try {
      // Simple echo response for now - can be enhanced with actual AI
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I received your message: "${userMessage.content}". Chat integration is active! In a full implementation, I would process this with the Sarah service to provide contextual explanations.`,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
      setWorkerStatus('available')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setWorkerStatus('degraded')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0 }}>🧠 Sarah - Explanation Generator</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setMode('form')}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                backgroundColor: mode === 'form' ? '#007bff' : '#e7e7e7',
                color: mode === 'form' ? 'white' : '#666',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Form Mode
            </button>
            <button
              onClick={() => setMode('chat')}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                backgroundColor: mode === 'chat' ? '#007bff' : '#e7e7e7',
                color: mode === 'chat' ? 'white' : '#666',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              💬 Chat Mode
            </button>
          </div>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 'bold',
          backgroundColor: workerStatus === 'available' ? '#d4edda' : workerStatus === 'degraded' ? '#fff3cd' : workerStatus === 'unavailable' ? '#f8d7da' : '#e7e7e7',
          color: workerStatus === 'available' ? '#155724' : workerStatus === 'degraded' ? '#856404' : workerStatus === 'unavailable' ? '#721c24' : '#666',
        }}>
          {workerStatus === 'available' ? '✓ Worker Available' : workerStatus === 'degraded' ? '⚠ Degraded' : workerStatus === 'unavailable' ? '✗ Unavailable' : '⏳ Checking...'}
        </div>
      </div>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        {mode === 'chat' 
          ? 'Chat with Sarah to get explanations and answers about your project.'
          : 'Sarah generates human-readable explanations from Rocky\'s structured facts.'}
      </p>

      {mode === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: '#f8f9fa',
            marginBottom: '16px',
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 20px' }}>
                <p>👋 Hi! I'm Sarah. Ask me anything about your survey or project.</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  Try asking: "What did we find during the survey?" or "What are the next steps?"
                </p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      backgroundColor: msg.role === 'user' ? '#007bff' : 'white',
                      color: msg.role === 'user' ? 'white' : '#333',
                      border: msg.role === 'assistant' ? '1px solid #ddd' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <div style={{ marginBottom: '4px', fontSize: '12px', opacity: 0.8 }}>
                      {msg.role === 'user' ? 'You' : '🧠 Sarah'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
            {loading && mode === 'chat' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>Sarah is typing...</div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask Sarah a question..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '8px',
              }}
            />
            <button
              type="submit"
              disabled={loading || !chatInput.trim()}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'white',
                backgroundColor: loading || !chatInput.trim() ? '#999' : '#007bff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !chatInput.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Send
            </button>
          </form>

          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                color: '#c00',
                marginTop: '12px',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}

      {mode === 'form' && (
        <div>

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
      )}
    </div>
  )
}

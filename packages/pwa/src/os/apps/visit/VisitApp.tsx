import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { 
  Customer, 
  VisitSession,
  VisitObservation,
  ApiResponse, 
  PaginatedResponse 
} from '@hail-mary/shared'
import './VisitApp.css'

// Simple API client
const api = {
  async get<T>(url: string): Promise<T> {
    const res = await fetch(url)
    return res.json()
  },
  async post<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
  async put<T>(url: string, data: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return res.json()
  },
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

/** 
 * Timeline entry representing a message in the visit conversation
 * - 'user': A logged observation from the user (typed or spoken)
 * - 'system': A response from the assistant service
 */
interface TimelineEntry {
  id: string
  type: 'user' | 'system'
  text: string
  timestamp: Date
}

type ViewMode = 'list' | 'active'

export const VisitApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [activeSession, setActiveSession] = useState<VisitSession | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  
  // STT state
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [sttSupported, setSttSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check for STT support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setSttSupported(!!SpeechRecognition)
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-GB'
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    // Load customers
    api.get<PaginatedResponse<Customer>>('/api/customers')
      .then(res => {
        setCustomers(res.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const startVisit = async (customer: Customer) => {
    setLoading(true)
    try {
      const res = await api.post<ApiResponse<VisitSession>>('/api/visit-sessions', {
        accountId: 1,
        customerId: customer.id,
      })
      
      if (res.success && res.data) {
        setSelectedCustomer(customer)
        setActiveSession(res.data)
        setViewMode('active')
        setTimeline([])
      }
    } catch (error) {
      console.error('Failed to start visit:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExistingVisit = async (customer: Customer) => {
    setLoading(true)
    try {
      // Try to find an active session for this customer
      const sessionsRes = await api.get<PaginatedResponse<VisitSession>>(`/api/visit-sessions?customerId=${customer.id}&status=in_progress`)
      
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const session = sessionsRes.data[0]
        setSelectedCustomer(customer)
        setActiveSession(session)
        
        // Load observations
        const observationsRes = await api.get<ApiResponse<VisitObservation[]>>(`/api/visit-sessions/${session.id}/observations`)
        if (observationsRes.success && observationsRes.data) {
          const entries: TimelineEntry[] = observationsRes.data.map(obs => ({
            id: `obs-${obs.id}`,
            type: 'user' as const,
            text: obs.text,
            timestamp: new Date(obs.createdAt),
          }))
          setTimeline(entries)
        }
        setViewMode('active')
      } else {
        // No active session, start new one
        startVisit(customer)
      }
    } catch {
      console.error('Failed to load visit')
      startVisit(customer)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (messageOverride?: string) => {
    const isFromTranscript = !!messageOverride
    const messageText = (messageOverride || inputText).trim()
    if (!messageText || !activeSession || !selectedCustomer) return
    
    setSending(true)
    // Only clear the input source that was used
    if (isFromTranscript) {
      setTranscript('')
    } else {
      setInputText('')
    }
    
    // Add user message to timeline immediately
    const userEntry: TimelineEntry = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: messageText,
      timestamp: new Date(),
    }
    setTimeline(prev => [...prev, userEntry])
    
    try {
      const res = await api.post<ApiResponse<{ assistantReply: string }>>('/assistant/message', {
        sessionId: activeSession.id,
        customerId: selectedCustomer.id,
        text: messageText,
      })
      
      if (res.success && res.data) {
        const systemEntry: TimelineEntry = {
          id: `system-${Date.now()}`,
          type: 'system',
          text: res.data.assistantReply,
          timestamp: new Date(),
        }
        setTimeline(prev => [...prev, systemEntry])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorEntry: TimelineEntry = {
        id: `error-${Date.now()}`,
        type: 'system',
        text: '⚠️ Failed to log observation. Please try again.',
        timestamp: new Date(),
      }
      setTimeline(prev => [...prev, errorEntry])
    } finally {
      setSending(false)
    }
  }

  // STT Functions
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return
    
    setTranscript('')
    
    recognitionRef.current.onstart = () => {
      setIsListening(true)
    }
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }
      
      if (finalTranscript) {
        // Properly join final transcripts with trimming to avoid extra spaces
        setTranscript(prev => {
          const trimmedPrev = prev.trim()
          const trimmedNew = finalTranscript.trim()
          return trimmedPrev ? `${trimmedPrev} ${trimmedNew}` : trimmedNew
        })
      } else if (interimTranscript) {
        // For interim results, append to existing final content
        setTranscript(prev => {
          const trimmedPrev = prev.trim()
          const trimmedInterim = interimTranscript.trim()
          return trimmedPrev ? `${trimmedPrev} ${trimmedInterim}` : trimmedInterim
        })
      }
    }
    
    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      if (event.error !== 'aborted') {
        setTimeline(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: 'system',
          text: `🎤 Microphone error: ${event.error}. Please try again.`,
          timestamp: new Date(),
        }])
      }
    }
    
    recognitionRef.current.onend = () => {
      setIsListening(false)
    }
    
    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    
    recognitionRef.current.stop()
    setIsListening(false)
    
    // Send the transcript if we have content
    if (transcript.trim()) {
      handleSendMessage(transcript.trim())
    }
  }, [transcript])

  const cancelListening = useCallback(() => {
    if (!recognitionRef.current) return
    
    recognitionRef.current.abort()
    setIsListening(false)
    setTranscript('')
  }, [])

  const endVisit = async () => {
    if (!activeSession) return
    
    try {
      await api.put<ApiResponse<VisitSession>>(`/api/visit-sessions/${activeSession.id}`, {
        status: 'completed',
        endedAt: new Date(),
      })
      setViewMode('list')
      setActiveSession(null)
      setSelectedCustomer(null)
      setTimeline([])
    } catch (error) {
      console.error('Failed to end visit:', error)
    }
  }

  if (loading) {
    return <div className="visit-app-loading">Loading...</div>
  }

  if (viewMode === 'active' && activeSession && selectedCustomer) {
    return (
      <div className="visit-app">
        <div className="visit-app-header">
          <div className="visit-app-header-info">
            <h2>🎙️ {selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
            <span className="visit-status-badge">Active Visit</span>
          </div>
          <button className="btn-secondary" onClick={endVisit}>
            End Visit
          </button>
        </div>

        <div className="visit-timeline">
          {timeline.length === 0 ? (
            <p className="visit-empty">
              Start recording your visit notes below. Speak or type your observations!
            </p>
          ) : (
            timeline.map(entry => (
              <div key={entry.id} className={`visit-entry visit-entry-${entry.type}`}>
                <div className="visit-entry-header">
                  <span className="visit-entry-label">
                    {entry.type === 'user' ? '🎤 You:' : '🤖 System:'}
                  </span>
                  <span className="visit-entry-time">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="visit-entry-text">{entry.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="visit-input-area">
          {/* Live transcript display */}
          {isListening && (
            <div className="visit-transcript">
              <div className="transcript-header">
                <span className="transcript-recording">🔴 Recording...</span>
                <button className="btn-cancel" onClick={cancelListening}>✕ Cancel</button>
              </div>
              <p className="transcript-text">
                {transcript || 'Listening... Speak now.'}
              </p>
            </div>
          )}
          
          <div className="visit-input-row">
            {/* Mic button */}
            {sttSupported && (
              <button
                className={`btn-mic ${isListening ? 'recording' : ''}`}
                onClick={isListening ? stopListening : startListening}
                disabled={sending}
                title={isListening ? 'Stop & Send' : 'Start Recording'}
              >
                {isListening ? '⏹️' : '🎤'}
              </button>
            )}
            
            <input
              type="text"
              placeholder={isListening ? 'Recording...' : 'Type your observation...'}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              disabled={sending || isListening}
            />
            <button 
              className="btn-primary"
              onClick={() => handleSendMessage()}
              disabled={sending || !inputText.trim() || isListening}
            >
              {sending ? '...' : '📝 Log'}
            </button>
          </div>
          
          {!sttSupported && (
            <p className="stt-unsupported">
              ℹ️ Voice input requires Chrome, Edge, or Safari
            </p>
          )}
        </div>
      </div>
    )
  }

  // Customer list view
  return (
    <div className="visit-app">
      <div className="visit-app-header">
        <h2>📋 Visit Notes</h2>
        <p className="visit-app-subtitle">Select a customer to start or continue a visit</p>
      </div>

      <div className="visit-customer-list">
        {customers.length === 0 ? (
          <p className="visit-empty">No customers yet. Create a customer first!</p>
        ) : (
          customers.map(customer => (
            <button
              key={customer.id}
              className="visit-customer-item"
              onClick={() => loadExistingVisit(customer)}
            >
              <div className="visit-customer-info">
                <strong>{customer.firstName} {customer.lastName}</strong>
                <span>{customer.address?.city || customer.email}</span>
              </div>
              <span className="visit-customer-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

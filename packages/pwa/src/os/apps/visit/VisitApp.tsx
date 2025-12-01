import React, { useState, useEffect } from 'react'
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

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSession || !selectedCustomer) return
    
    setSending(true)
    const messageText = inputText.trim()
    setInputText('')
    
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
          <div className="visit-input-row">
            <input
              type="text"
              placeholder="Type your observation..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              disabled={sending}
            />
            <button 
              className="btn-primary"
              onClick={handleSendMessage}
              disabled={sending || !inputText.trim()}
            >
              {sending ? '...' : '📝 Log'}
            </button>
          </div>
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

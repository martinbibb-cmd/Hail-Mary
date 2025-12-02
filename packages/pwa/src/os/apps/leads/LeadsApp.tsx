import React, { useState, useEffect } from 'react'
import type { 
  Lead, 
  ApiResponse, 
  PaginatedResponse 
} from '@hail-mary/shared'
import { useWindowStore } from '../../window-manager'
import './LeadsApp.css'

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
}

type ViewMode = 'list' | 'detail' | 'new'

const statusColors: Record<string, string> = {
  new: '#007aff',
  contacted: '#ffbd2e',
  qualified: '#27c93f',
  quoted: '#e94560',
  won: '#32d74b',
  lost: '#888',
}

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
}

export const LeadsApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    source: '',
    description: '',
    propertyType: '',
    notes: '',
  })

  const openWindow = useWindowStore((state) => state.openWindow)

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    try {
      const res = await api.get<PaginatedResponse<Lead>>('/api/leads')
      setLeads(res.data || [])
    } catch (error) {
      console.error('Failed to load leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead)
    setViewMode('detail')
  }

  const handleBackToList = () => {
    setSelectedLead(null)
    setViewMode('list')
    setMessage('')
  }

  const handleNewLead = () => {
    setViewMode('new')
    setForm({
      source: '',
      description: '',
      propertyType: '',
      notes: '',
    })
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<ApiResponse<Lead>>('/api/leads', form)
      if (res.success) {
        setMessage('Lead created successfully!')
        await loadLeads()
        setTimeout(() => {
          setViewMode('list')
          setMessage('')
        }, 1500)
      } else {
        setMessage('Error: ' + res.error)
      }
    } catch (error) {
      setMessage('Failed to create lead')
    }
  }

  const handleStartVisit = () => {
    openWindow('visit', 'Visit / Notes')
  }

  const handleScheduleDiary = () => {
    openWindow('diary', 'Diary')
  }

  const handleCreateQuote = () => {
    openWindow('quote', 'Quote')
  }

  if (loading) {
    return <div className="leads-app-loading">Loading leads...</div>
  }

  // New Lead Form View
  if (viewMode === 'new') {
    return (
      <div className="leads-app">
        <div className="leads-app-header">
          <button className="btn-back" onClick={handleBackToList}>
            ← Back
          </button>
          <h2>New Lead</h2>
        </div>

        {message && <div className="leads-message">{message}</div>}

        <form className="leads-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Source</label>
            <select
              value={form.source}
              onChange={e => setForm({ ...form, source: e.target.value })}
              required
            >
              <option value="">Select source...</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="phone">Phone</option>
              <option value="walk-in">Walk-in</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
              rows={3}
              placeholder="Describe the lead..."
            />
          </div>
          <div className="form-row">
            <label>Property Type</label>
            <select
              value={form.propertyType}
              onChange={e => setForm({ ...form, propertyType: e.target.value })}
            >
              <option value="">Select type...</option>
              <option value="house">House</option>
              <option value="flat">Flat</option>
              <option value="bungalow">Bungalow</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
          <button type="submit" className="btn-primary">
            Create Lead
          </button>
        </form>
      </div>
    )
  }

  // Lead Detail View
  if (viewMode === 'detail' && selectedLead) {
    return (
      <div className="leads-app">
        <div className="leads-app-header">
          <button className="btn-back" onClick={handleBackToList}>
            ← Back
          </button>
          <h2>Lead Details</h2>
        </div>

        <div className="lead-detail">
          <div className="lead-status-header">
            <span 
              className="lead-status-badge"
              style={{ backgroundColor: statusColors[selectedLead.status] || '#888' }}
            >
              {statusLabels[selectedLead.status] || selectedLead.status}
            </span>
          </div>

          <div className="detail-card">
            <h3>Description</h3>
            <p>{selectedLead.description}</p>
          </div>

          <div className="detail-card">
            <h3>Details</h3>
            <p><strong>Source:</strong> {selectedLead.source}</p>
            {selectedLead.propertyType && (
              <p><strong>Property Type:</strong> {selectedLead.propertyType}</p>
            )}
            {selectedLead.estimatedValue && (
              <p><strong>Estimated Value:</strong> £{selectedLead.estimatedValue.toLocaleString()}</p>
            )}
          </div>

          {selectedLead.notes && (
            <div className="detail-card">
              <h3>Notes</h3>
              <p>{selectedLead.notes}</p>
            </div>
          )}

          <div className="lead-actions">
            <button className="btn-primary" onClick={handleStartVisit}>
              🎙️ Start Visit
            </button>
            <button className="btn-secondary" onClick={handleScheduleDiary}>
              🗓 Schedule
            </button>
            <button className="btn-secondary" onClick={handleCreateQuote}>
              £ Create Quote
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Lead List View
  return (
    <div className="leads-app">
      <div className="leads-app-header">
        <h2>🧲 Leads</h2>
        <button className="btn-primary" onClick={handleNewLead}>
          + New Lead
        </button>
      </div>

      <div className="leads-list">
        {leads.length === 0 ? (
          <p className="leads-empty">No leads yet. Create your first lead!</p>
        ) : (
          leads.map(lead => (
            <button
              key={lead.id}
              className="lead-item"
              onClick={() => handleSelectLead(lead)}
            >
              <div className="lead-info">
                <div className="lead-title-row">
                  <strong>{lead.description}</strong>
                  <span 
                    className="lead-status-dot"
                    style={{ backgroundColor: statusColors[lead.status] || '#888' }}
                  />
                </div>
                <span>Source: {lead.source}</span>
                {lead.propertyType && (
                  <span className="lead-property">🏠 {lead.propertyType}</span>
                )}
              </div>
              <span className="lead-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

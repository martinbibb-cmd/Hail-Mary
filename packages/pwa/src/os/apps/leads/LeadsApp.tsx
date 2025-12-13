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
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: {
      line1: '',
      city: '',
      postcode: '',
      country: 'UK',
    },
    source: '',
    description: '',
    propertyType: '',
    notes: '',
  })

  const openWindow = useWindowStore((state) => state.openWindow)

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredLeads(leads)
    } else {
      setFilteredLeads(leads.filter(lead => lead.status === statusFilter))
    }
  }, [leads, statusFilter])

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
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: {
        line1: '',
        city: '',
        postcode: '',
        country: 'UK',
      },
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
          <h3>Contact Information</h3>
          <div className="form-row">
            <label>First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Address</label>
            <input
              type="text"
              placeholder="Street address"
              value={form.address.line1}
              onChange={e => setForm({ ...form, address: { ...form.address, line1: e.target.value } })}
            />
          </div>
          <div className="form-row-group">
            <div className="form-row">
              <label>City</label>
              <input
                type="text"
                value={form.address.city}
                onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })}
              />
            </div>
            <div className="form-row">
              <label>Postcode</label>
              <input
                type="text"
                value={form.address.postcode}
                onChange={e => setForm({ ...form, address: { ...form.address, postcode: e.target.value } })}
              />
            </div>
          </div>

          <h3>Lead Information</h3>
          <div className="form-row">
            <label>Source</label>
            <select
              value={form.source}
              onChange={e => setForm({ ...form, source: e.target.value })}
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
              rows={3}
              placeholder="Describe the enquiry..."
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
            <h3>Contact Information</h3>
            <p><strong>Name:</strong> {selectedLead.firstName} {selectedLead.lastName}</p>
            <p><strong>Email:</strong> {selectedLead.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {selectedLead.phone || 'N/A'}</p>
          </div>

          <div className="detail-card">
            <h3>Address</h3>
            <p>{selectedLead.address?.line1 || 'N/A'}</p>
            {selectedLead.address?.line2 && <p>{selectedLead.address.line2}</p>}
            <p>{selectedLead.address?.city}, {selectedLead.address?.postcode}</p>
            <p>{selectedLead.address?.country}</p>
          </div>

          {selectedLead.description && (
            <div className="detail-card">
              <h3>Description</h3>
              <p>{selectedLead.description}</p>
            </div>
          )}

          <div className="detail-card">
            <h3>Lead Details</h3>
            {selectedLead.source && (
              <p><strong>Source:</strong> {selectedLead.source}</p>
            )}
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

      <div className="leads-filter-bar">
        <label>Filter by status:</label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Leads ({leads.length})</option>
          <option value="new">New ({leads.filter(l => l.status === 'new').length})</option>
          <option value="contacted">Contacted ({leads.filter(l => l.status === 'contacted').length})</option>
          <option value="qualified">Qualified ({leads.filter(l => l.status === 'qualified').length})</option>
          <option value="quoted">Quoted ({leads.filter(l => l.status === 'quoted').length})</option>
          <option value="won">Active Customers ({leads.filter(l => l.status === 'won').length})</option>
          <option value="lost">Lost ({leads.filter(l => l.status === 'lost').length})</option>
        </select>
      </div>

      <div className="leads-list">
        {filteredLeads.length === 0 ? (
          <p className="leads-empty">
            {statusFilter === 'all'
              ? 'No leads yet. Create your first lead!'
              : `No ${statusFilter === 'won' ? 'active customers' : statusFilter} leads found.`}
          </p>
        ) : (
          filteredLeads.map(lead => (
            <button
              key={lead.id}
              className="lead-item"
              onClick={() => handleSelectLead(lead)}
            >
              <div className="lead-info">
                <div className="lead-title-row">
                  <strong>{lead.firstName} {lead.lastName}</strong>
                  <span
                    className="lead-status-dot"
                    style={{ backgroundColor: statusColors[lead.status] || '#888' }}
                  />
                </div>
                <span>{lead.email || lead.phone || 'No contact info'}</span>
                {lead.description && (
                  <span className="lead-description">{lead.description}</span>
                )}
                {lead.address?.city && (
                  <span className="lead-location">📍 {lead.address.city}</span>
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

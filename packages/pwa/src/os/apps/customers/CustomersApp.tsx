import React, { useState, useEffect } from 'react'
import type { 
  Customer, 
  ApiResponse, 
  PaginatedResponse 
} from '@hail-mary/shared'
import { useWindowStore } from '../../window-manager'
import './CustomersApp.css'

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

export const CustomersApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
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
  })

  const openWindow = useWindowStore((state) => state.openWindow)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const res = await api.get<PaginatedResponse<Customer>>('/api/customers')
      setCustomers(res.data || [])
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setViewMode('detail')
  }

  const handleBackToList = () => {
    setSelectedCustomer(null)
    setViewMode('list')
    setMessage('')
  }

  const handleNewCustomer = () => {
    setViewMode('new')
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: { line1: '', city: '', postcode: '', country: 'UK' },
    })
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post<ApiResponse<Customer>>('/api/customers', form)
      if (res.success) {
        setMessage('Customer created successfully!')
        await loadCustomers()
        setTimeout(() => {
          setViewMode('list')
          setMessage('')
        }, 1500)
      } else {
        setMessage('Error: ' + res.error)
      }
    } catch (error) {
      setMessage('Failed to create customer')
    }
  }

  const handleStartVisit = () => {
    // Open Visit app (it will handle creating a session)
    openWindow('visit', 'Visit / Notes')
  }

  const handleScheduleDiary = () => {
    // Open Diary app
    openWindow('diary', 'Diary')
  }

  if (loading) {
    return <div className="customers-app-loading">Loading customers...</div>
  }

  // New Customer Form View
  if (viewMode === 'new') {
    return (
      <div className="customers-app">
        <div className="customers-app-header">
          <button className="btn-back" onClick={handleBackToList}>
            ← Back
          </button>
          <h2>New Customer</h2>
        </div>

        {message && <div className="customers-message">{message}</div>}

        <form className="customers-form" onSubmit={handleSubmit}>
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
          <button type="submit" className="btn-primary">
            Create Customer
          </button>
        </form>
      </div>
    )
  }

  // Customer Detail View
  if (viewMode === 'detail' && selectedCustomer) {
    return (
      <div className="customers-app">
        <div className="customers-app-header">
          <button className="btn-back" onClick={handleBackToList}>
            ← Back
          </button>
          <h2>{selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
        </div>

        <div className="customer-detail">
          <div className="detail-card">
            <h3>Contact Information</h3>
            <p><strong>Email:</strong> {selectedCustomer.email || 'N/A'}</p>
            <p><strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}</p>
          </div>

          <div className="detail-card">
            <h3>Address</h3>
            <p>{selectedCustomer.address?.line1 || 'N/A'}</p>
            {selectedCustomer.address?.line2 && <p>{selectedCustomer.address.line2}</p>}
            <p>{selectedCustomer.address?.city}, {selectedCustomer.address?.postcode}</p>
            <p>{selectedCustomer.address?.country}</p>
          </div>

          {selectedCustomer.notes && (
            <div className="detail-card">
              <h3>Notes</h3>
              <p>{selectedCustomer.notes}</p>
            </div>
          )}

          <div className="customer-actions">
            <button className="btn-primary btn-large" onClick={handleStartVisit}>
              🎙️ Start Visit
            </button>
            <button className="btn-secondary" onClick={handleScheduleDiary}>
              🗓 Schedule Appointment
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Customer List View
  return (
    <div className="customers-app">
      <div className="customers-app-header">
        <h2>📁 Customers</h2>
        <button className="btn-primary" onClick={handleNewCustomer}>
          + New Customer
        </button>
      </div>

      <div className="customers-list">
        {customers.length === 0 ? (
          <p className="customers-empty">No customers yet. Create your first customer!</p>
        ) : (
          customers.map(customer => (
            <button
              key={customer.id}
              className="customer-item"
              onClick={() => handleSelectCustomer(customer)}
            >
              <div className="customer-info">
                <strong>{customer.firstName} {customer.lastName}</strong>
                <span>{customer.email || customer.phone || 'No contact info'}</span>
                {customer.address?.city && (
                  <span className="customer-location">📍 {customer.address.city}</span>
                )}
              </div>
              <span className="customer-arrow">→</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

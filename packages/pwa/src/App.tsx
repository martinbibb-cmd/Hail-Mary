import { Routes, Route, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { Customer, Quote, Lead, ApiResponse, PaginatedResponse } from '@hail-mary/shared'

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

// Dashboard Component
function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, quotes: 0, leads: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResponse<Customer>>('/api/customers?limit=1'),
      api.get<PaginatedResponse<Quote>>('/api/quotes?limit=1'),
      api.get<PaginatedResponse<Lead>>('/api/leads?limit=1'),
    ]).then(([customers, quotes, leads]) => {
      setStats({
        customers: customers.pagination?.total || 0,
        quotes: quotes.pagination?.total || 0,
        leads: leads.pagination?.total || 0,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Customers</h3>
          <p className="stat-number">{stats.customers}</p>
          <Link to="/customers">View all →</Link>
        </div>
        <div className="stat-card">
          <h3>Quotes</h3>
          <p className="stat-number">{stats.quotes}</p>
          <Link to="/quotes">View all →</Link>
        </div>
        <div className="stat-card">
          <h3>Leads</h3>
          <p className="stat-number">{stats.leads}</p>
          <Link to="/leads">View all →</Link>
        </div>
      </div>
    </div>
  )
}

// Customers List Component
function CustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PaginatedResponse<Customer>>('/api/customers')
      .then(res => {
        setCustomers(res.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="list-page">
      <div className="page-header">
        <h1>Customers</h1>
        <Link to="/customers/new" className="btn-primary">+ New Customer</Link>
      </div>
      {customers.length === 0 ? (
        <p className="empty-state">No customers yet. Create your first customer!</p>
      ) : (
        <div className="list">
          {customers.map(c => (
            <div key={c.id} className="list-item">
              <div>
                <h3>{c.firstName} {c.lastName}</h3>
                <p>{c.email} • {c.phone}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Quotes List Component
function QuotesList() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PaginatedResponse<Quote>>('/api/quotes')
      .then(res => {
        setQuotes(res.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="list-page">
      <div className="page-header">
        <h1>Quotes</h1>
        <Link to="/quotes/new" className="btn-primary">+ New Quote</Link>
      </div>
      {quotes.length === 0 ? (
        <p className="empty-state">No quotes yet. Create your first quote!</p>
      ) : (
        <div className="list">
          {quotes.map(q => (
            <div key={q.id} className="list-item">
              <div>
                <h3>{q.quoteNumber}: {q.title}</h3>
                <p>Status: {q.status} • Total: £{q.total.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Leads List Component
function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PaginatedResponse<Lead>>('/api/leads')
      .then(res => {
        setLeads(res.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="list-page">
      <div className="page-header">
        <h1>Leads</h1>
        <Link to="/leads/new" className="btn-primary">+ New Lead</Link>
      </div>
      {leads.length === 0 ? (
        <p className="empty-state">No leads yet. Create your first lead!</p>
      ) : (
        <div className="list">
          {leads.map(l => (
            <div key={l.id} className="list-item">
              <div>
                <h3>{l.description}</h3>
                <p>Source: {l.source} • Status: {l.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// New Customer Form
function NewCustomer() {
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
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await api.post<ApiResponse<Customer>>('/api/customers', form)
    if (res.success) {
      setMessage('Customer created successfully!')
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: { line1: '', city: '', postcode: '', country: 'UK' },
      })
    } else {
      setMessage('Error: ' + res.error)
    }
  }

  return (
    <div className="form-page">
      <h1>New Customer</h1>
      {message && <div className="message">{message}</div>}
      <form onSubmit={handleSubmit}>
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
        <button type="submit" className="btn-primary">Create Customer</button>
      </form>
      <Link to="/customers" className="back-link">← Back to Customers</Link>
    </div>
  )
}

// New Lead Form
function NewLead() {
  const [form, setForm] = useState({
    source: '',
    description: '',
    propertyType: '',
    notes: '',
  })
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await api.post<ApiResponse<Lead>>('/api/leads', form)
    if (res.success) {
      setMessage('Lead created successfully!')
      setForm({ source: '', description: '', propertyType: '', notes: '' })
    } else {
      setMessage('Error: ' + res.error)
    }
  }

  return (
    <div className="form-page">
      <h1>New Lead</h1>
      {message && <div className="message">{message}</div>}
      <form onSubmit={handleSubmit}>
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
          />
        </div>
        <button type="submit" className="btn-primary">Create Lead</button>
      </form>
      <Link to="/leads" className="back-link">← Back to Leads</Link>
    </div>
  )
}

// Main App Component
function App() {
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <h2>🔥 Hail-Mary</h2>
        </div>
        <ul className="nav-links">
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/customers">Customers</Link></li>
          <li><Link to="/quotes">Quotes</Link></li>
          <li><Link to="/leads">Leads</Link></li>
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersList />} />
          <Route path="/customers/new" element={<NewCustomer />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/new" element={<NewLead />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

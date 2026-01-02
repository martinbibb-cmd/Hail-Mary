import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type {
  Customer,
  Quote,
  Lead,
  ApiResponse,
  PaginatedResponse,
  VisitSession,
  VisitObservation,
  AssistantMessageResponse,
} from '@hail-mary/shared'
import { Desktop, DesktopWorkspace, StackWorkspace } from './os'
import { AuthProvider, AuthGuard, ResetPasswordPage, useAuth } from './auth'
import { useCognitiveProfile } from './cognitive/CognitiveProfileContext'
import { CognitiveOverlays } from './cognitive/CognitiveOverlays'
import { useLayoutMode } from './hooks/useLayoutMode'
import { apiFetch } from './services/apiClient'
import { LeadWorkspace } from './modules/leadWorkspace/LeadWorkspace'
import { AdminUsersPage, AdminNasPage, AdminKnowledgePage, AdminSystemRecommendationPage, AdminLeadAssignmentsPage, AdminBugDashboardPage, AdminBugListPage, AdminBugDetailPage, AdminBugAnalyticsPage } from './pages/admin'
import { ModuleLauncher } from './pages/ModuleLauncher'
import { ProfileApp } from './os/apps/profile/ProfileApp'
import { FilesApp } from './os/apps/files/FilesApp'
import { DiaryApp } from './os/apps/diary/DiaryApp'
import { TranscriptsApp } from './os/apps/transcripts/TranscriptsApp'
import { PhotoLibraryApp } from './os/apps/photo-library/PhotoLibraryApp'
import { ScansApp } from './os/apps/scans/ScansApp'
import { AddressesApp } from './os/apps/addresses/AddressesApp'
import { TrajectoryApp } from './os/apps/trajectory/TrajectoryApp'
import { BottomDock } from './components/BottomDock'
import { RockyToolWithGuard, SarahToolWithGuard, PhotosAppWithGuard, VisitAppWithGuard } from './components/ProtectedRoutes'
import { useLeadStore } from './stores/leadStore'
import { useSpineStore } from './stores/spineStore'
import { ActivePropertyBar } from './components/ActivePropertyBar'
import { SpinePropertyPage } from './pages/SpinePropertyPage'
import { SpinePlaceholderPage } from './pages/SpinePlaceholderPage'
import { SpineCameraPage } from './pages/SpineCameraPage'
import { SpineEngineerPage } from './pages/SpineEngineerPage'
import { SpineSarahPage } from './pages/SpineSarahPage'
import { SpineKnowledgePage } from './pages/SpineKnowledgePage'
import { SpineKnowledgeDocPage } from './pages/SpineKnowledgeDocPage'
import { CustomerSummaryPage } from './pages/CustomerSummaryPage'
import { PresentationPage } from './pages/PresentationPage'
import { GCLookupPage } from './pages/GCLookupPage'

// Simple API client
const api = {
  async get<T>(url: string): Promise<T> {
    return apiFetch<T>(url)
  },
  async post<T>(url: string, data: unknown): Promise<T> {
    return apiFetch<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async put<T>(url: string, data: unknown): Promise<T> {
    return apiFetch<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
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
            <Link key={c.id} to={`/customers/${c.id}`} className="list-item-link">
              <div className="list-item">
                <div>
                  <h3>{c.firstName} {c.lastName}</h3>
                  <p>{c.email} • {c.phone}</p>
                </div>
                <span className="arrow">→</span>
              </div>
            </Link>
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
            <Link key={l.id} to={`/leads/${l.id}`} className="list-item-link">
              <div className="list-item">
                <div>
                  <h3>{l.firstName} {l.lastName}</h3>
                  <p>{l.description || 'No description'}</p>
                  <p>Source: {l.source} • Status: {l.status}</p>
                </div>
                <span className="arrow">→</span>
              </div>
            </Link>
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

// Customer Detail Component with Start Visit button
function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingVisit, setStartingVisit] = useState(false)

  useEffect(() => {
    if (id) {
      api.get<ApiResponse<Customer>>(`/api/customers/${id}`)
        .then(res => {
          if (res.success && res.data) {
            setCustomer(res.data)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [id])

  const handleStartVisit = async () => {
    if (!customer || !user) return
    setStartingVisit(true)

    try {
      const res = await api.post<ApiResponse<VisitSession>>('/api/visit-sessions', {
        accountId: user.accountId,
        leadId: customer.id,
      })
      
      if (res.success && res.data) {
        navigate(`/customers/${customer.id}/visit/${res.data.id}`)
      } else {
        alert('Failed to start visit: ' + (res.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Failed to start visit')
    } finally {
      setStartingVisit(false)
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!customer) return <div className="error">Customer not found</div>

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>{customer.firstName} {customer.lastName}</h1>
        <button 
          className="btn-primary btn-large"
          onClick={handleStartVisit}
          disabled={startingVisit}
        >
          {startingVisit ? '🔄 Starting...' : '🎙️ Start Visit'}
        </button>
      </div>
      
      <div className="detail-card">
        <h3>Contact Information</h3>
        <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
        <p><strong>Phone:</strong> {customer.phone || 'N/A'}</p>
      </div>
      
      <div className="detail-card">
        <h3>Address</h3>
        <p>{customer.address?.line1 || 'N/A'}</p>
        {customer.address?.line2 && <p>{customer.address.line2}</p>}
        <p>{customer.address?.city}, {customer.address?.postcode}</p>
        <p>{customer.address?.country}</p>
      </div>
      
      {customer.notes && (
        <div className="detail-card">
          <h3>Notes</h3>
          <p>{customer.notes}</p>
        </div>
      )}
      
      <Link to="/customers" className="back-link">← Back to Customers</Link>
    </div>
  )
}

// Timeline entry type for the visit page
interface TimelineEntry {
  id: string
  type: 'user' | 'system'
  text: string
  timestamp: Date
}

// Visit Page Component - Voice-first workflow
function VisitPage() {
  const { leadId, visitSessionId } = useParams<{ leadId: string; visitSessionId: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<Customer | null>(null)
  const [session, setSession] = useState<VisitSession | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load lead and session data
        const [leadRes, sessionRes, observationsRes] = await Promise.all([
          api.get<ApiResponse<Customer>>(`/api/leads/${leadId}`),
          api.get<ApiResponse<VisitSession>>(`/api/visit-sessions/${visitSessionId}`),
          api.get<ApiResponse<VisitObservation[]>>(`/api/visit-sessions/${visitSessionId}/observations`),
        ])

        if (leadRes.success && leadRes.data) {
          setLead(leadRes.data)
        }
        if (sessionRes.success && sessionRes.data) {
          setSession(sessionRes.data)
        }
        if (observationsRes.success && observationsRes.data) {
          // Convert existing observations to timeline entries
          const entries: TimelineEntry[] = observationsRes.data.map(obs => ({
            id: `obs-${obs.id}`,
            type: 'user' as const,
            text: obs.text,
            timestamp: new Date(obs.createdAt),
          }))
          setTimeline(entries)
        }
      } catch (error) {
        console.error('Failed to load visit data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [leadId, visitSessionId])

  const handleSendMessage = async () => {
    if (!inputText.trim() || !session || !lead) return

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
      // Send to assistant service
      // Note: In production, the assistant runs on a different port (3002)
      // For now, we're using the API proxy or assuming same-origin
      const res = await api.post<ApiResponse<AssistantMessageResponse>>('/assistant/message', {
        sessionId: session.id,
        leadId: Number(lead.id),
        text: messageText,
      })
      
      if (res.success && res.data) {
        // Add system response to timeline
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
      // Add error message to timeline
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

  const handleEndVisit = async () => {
    if (!session) return

    try {
      await api.put<ApiResponse<VisitSession>>(`/api/visit-sessions/${session.id}`, {
        status: 'completed',
        endedAt: new Date().toISOString(),
      })
      // Navigate back to lead detail using React Router
      navigate(`/leads/${leadId}`)
    } catch (error) {
      console.error('Failed to end visit:', error)
    }
  }

  if (loading) return <div className="loading">Loading visit...</div>
  if (!lead || !session) return <div className="error">Visit not found</div>

  return (
    <div className="visit-page">
      <div className="visit-header">
        <div>
          <h1>Visit: {lead.firstName} {lead.lastName}</h1>
          <p className="visit-status">Status: {session.status}</p>
        </div>
        <button className="btn-secondary" onClick={handleEndVisit}>
          End Visit
        </button>
      </div>
      
      <div className="timeline">
        {timeline.length === 0 ? (
          <p className="empty-timeline">
            No observations yet. Start recording your visit notes below!
          </p>
        ) : (
          timeline.map(entry => (
            <div key={entry.id} className={`timeline-entry timeline-${entry.type}`}>
              <div className="entry-header">
                <span className="entry-label">
                  {entry.type === 'user' ? '🎤 You said:' : '🤖 System:'}
                </span>
                <span className="entry-time">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="entry-text">{entry.text}</p>
            </div>
          ))
        )}
      </div>
      
      <div className="input-area">
        <div className="input-row">
          <input
            type="text"
            placeholder="Type your observation or use voice..."
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
            className="btn-primary btn-record"
            onClick={handleSendMessage}
            disabled={sending || !inputText.trim()}
          >
            {sending ? '...' : '📝 Log'}
          </button>
        </div>
        <p className="input-hint">
          Press Enter to log your observation. Voice input coming soon!
        </p>
      </div>

      <Link to={`/leads/${leadId}`} className="back-link">
        ← Back to Lead
      </Link>
    </div>
  )
}

// Main App Component
function App() {
  const { profile } = useCognitiveProfile()
  const isFocusProfile = profile === 'focus'
  const layout = useLayoutMode()
  const { hydrate } = useLeadStore()
  const hydrateSpine = useSpineStore((s) => s.hydrate)
  
  // Hydrate lead store from localStorage on mount
  useEffect(() => {
    hydrate()
    hydrateSpine()
  }, [hydrate, hydrateSpine])

  // Determine if using desktop or touch workspace
  const isDesktop = layout === 'desktop'
  const showBottomDock = !isDesktop

  // Main content component (shared between both workspaces)
  const mainContent = (
    <>
      {/* Traditional navigation sidebar (desktop only, not in focus mode) */}
      {isDesktop && !isFocusProfile && (
        <nav className="sidebar">
          <div className="logo">
            <h2>🔥 Hail-Mary</h2>
          </div>
          <ul className="nav-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/visit">Visit Notes</Link></li>
            <li><Link to="/customers">Customers</Link></li>
            <li><Link to="/quotes">Quotes</Link></li>
            <li><Link to="/leads">Leads</Link></li>
            <li><Link to="/profile">⚙️ Settings</Link></li>
          </ul>
        </nav>
      )}
      <main
        className={`content ${isFocusProfile ? 'content-focus' : ''} ${!isDesktop ? 'content-stack' : ''}`}
        style={showBottomDock ? { paddingBottom: '80px' } : undefined}
      >
        {/* v2 Spine TopBar (optional focus; never required) */}
        <ActivePropertyBar />
        
        {isFocusProfile && (
          <div className="focus-mode-banner">
            <p className="focus-mode-title">Focus Mode</p>
            <p className="focus-mode-copy">Extra UI is reduced to minimise distraction.</p>
          </div>
        )}
        <Routes>
          <Route path="/" element={<ModuleLauncher />} />
          <Route path="/home" element={<ModuleLauncher />} />
          <Route path="/addresses" element={<AddressesApp />} />
          <Route path="/properties/:id" element={<SpinePropertyPage />} />
          <Route path="/camera" element={<SpineCameraPage />} />
          <Route path="/voice" element={<SpinePlaceholderPage title="Voice" subtitle="Placeholder in PR #1." />} />
          <Route path="/engineer" element={<SpineEngineerPage />} />
          <Route path="/customer-summary" element={<CustomerSummaryPage />} />
          <Route path="/presentation" element={<PresentationPage />} />
          <Route path="/gc-lookup" element={<GCLookupPage />} />
          <Route path="/sarah" element={<SpineSarahPage />} />
          <Route path="/knowledge" element={<SpineKnowledgePage />} />
          <Route path="/knowledge/doc/:docId/page/:pageNo" element={<SpineKnowledgeDocPage />} />
          <Route path="/customers" element={<CustomersList />} />
          <Route path="/customers/new" element={<NewCustomer />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/leads/:leadId/visit/:visitSessionId" element={<VisitPage />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/new" element={<NewLead />} />
          <Route path="/leads/:id" element={<LeadWorkspace />} />
          <Route path="/diary" element={<DiaryApp />} />
          <Route path="/visit" element={<VisitAppWithGuard />} />
          <Route path="/rocky" element={<RockyToolWithGuard />} />
          <Route path="/tools/sarah" element={<SarahToolWithGuard />} />
          <Route path="/photos" element={<PhotosAppWithGuard />} />
          <Route path="/photo-library" element={<PhotoLibraryApp />} />
          <Route path="/scans" element={<ScansApp />} />
          <Route path="/trajectory" element={<TrajectoryApp />} />
          <Route path="/profile" element={<ProfileApp />} />
          <Route path="/files" element={<FilesApp />} />
          <Route path="/transcripts" element={<TranscriptsApp />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/nas" element={<AdminNasPage />} />
          <Route path="/admin/lead-assignments" element={<AdminLeadAssignmentsPage />} />
          <Route path="/admin/knowledge" element={<AdminKnowledgePage />} />
          <Route path="/admin/system-recommendation" element={<AdminSystemRecommendationPage />} />
          <Route path="/admin/bugs/dashboard" element={<AdminBugDashboardPage />} />
          <Route path="/admin/bugs/analytics" element={<AdminBugAnalyticsPage />} />
          <Route path="/admin/bugs/:id" element={<AdminBugDetailPage />} />
          <Route path="/admin/bugs" element={<AdminBugListPage />} />
        </Routes>
      </main>

      {/* Touch navigation (tablet/mobile only). Desktop uses sidebar + OS dock. */}
      {showBottomDock && (
        <BottomDock />
      )}
    </>
  )

  return (
    <AuthProvider>
      <Routes>
        {/* Password reset page outside of auth guard */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* All other routes require auth */}
        <Route path="/*" element={
          <AuthGuard>
            <Desktop>
              <CognitiveOverlays />

              {/* Conditionally render Desktop or Stack workspace based on device */}
              {isDesktop ? (
                <DesktopWorkspace>
                  {mainContent}
                </DesktopWorkspace>
              ) : (
                <StackWorkspace layout={layout}>
                  {mainContent}
                </StackWorkspace>
              )}
            </Desktop>
          </AuthGuard>
        } />
      </Routes>
    </AuthProvider>
  )
}

export default App

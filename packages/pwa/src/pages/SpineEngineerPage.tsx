import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export function SpineEngineerPage() {
  const navigate = useNavigate()
  const activeProperty = useSpineStore((s) => s.activeProperty)
  const activeVisitId = useSpineStore((s) => s.activeVisitId)

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabledReason = useMemo(() => {
    if (!activeVisitId) return 'No active visit. Start a visit first (Property → Start visit, or take a photo to auto-create).'
    return null
  }, [activeVisitId])

  const runEngineer = useCallback(async () => {
    if (!activeVisitId) return

    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/engineer/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId: activeVisitId, mode: 'survey' }),
      })

      const json = (await res.json()) as ApiResponse<{ eventId: string }>
      const eventId = json?.data?.eventId

      if (!res.ok || !json?.success || !eventId) {
        throw new Error(json?.error || 'Failed to run Engineer')
      }

      // Go to timeline (Home feed) and highlight the new output.
      navigate('/', { state: { highlightEventId: eventId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run Engineer')
    } finally {
      setRunning(false)
    }
  }, [activeVisitId, navigate])

  const openCustomerSummary = useCallback(() => {
    if (!activeVisitId) return
    navigate(`/customer-summary?visitId=${encodeURIComponent(activeVisitId)}`)
  }, [activeVisitId, navigate])

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>Engineer</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          Manual-only: tap to run once, writes output to timeline.
        </p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Active property: {activeProperty ? `${activeProperty.addressLine1} • ${activeProperty.postcode}` : 'None'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Active visit: {activeVisitId ?? 'None'}
          </div>

          <button className="btn-primary" onClick={runEngineer} disabled={running || !!disabledReason}>
            {running ? 'Running…' : 'Run Engineer'}
          </button>

          <button className="btn-secondary" onClick={openCustomerSummary} disabled={running || !!disabledReason}>
            Customer summary
          </button>

          {disabledReason ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{disabledReason}</div> : null}
          {error ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}
        </div>
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}


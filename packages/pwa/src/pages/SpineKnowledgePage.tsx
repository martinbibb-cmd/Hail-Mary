import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type ApiResponse<T> = { success: boolean; data?: T; error?: string }

type PageSearchResult = {
  pageId: number
  documentId: number
  title: string
  pageNumber: number
  snippet: string
  score: number
}

export function SpineKnowledgePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PageSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const canSearch = useMemo(() => query.trim().length > 0, [query])

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: q, topK: 20 }),
      })
      const json = (await res.json()) as ApiResponse<PageSearchResult[]>

      if (!res.ok || !json.success) {
        setResults([])
        setError(json.error || `Search failed (HTTP ${res.status})`)
        return
      }

      setResults(Array.isArray(json.data) ? json.data : [])
    } catch (e) {
      setResults([])
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Small UX: if user cleared the query, clear results.
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      setSearched(false)
    }
  }, [query])

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>Knowledge</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Search manuals and uploaded docs.</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search (e.g. flue clearance, condensate, pressure)…"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
          />
          <button className="btn-primary" onClick={runSearch} disabled={!canSearch || loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error ? <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

        {!loading && searched && results.length === 0 && !error ? (
          <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>No results.</div>
        ) : null}

        {results.length > 0 ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((r) => (
              <div
                key={`${r.documentId}-${r.pageNumber}-${r.pageId}`}
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--panel-2)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 800 }}>{r.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>p.{r.pageNumber}</div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.snippet}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Link className="btn-secondary" to={`/knowledge/doc/${r.documentId}/page/${r.pageNumber}`}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}


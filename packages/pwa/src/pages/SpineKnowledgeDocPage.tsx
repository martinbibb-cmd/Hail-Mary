import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

type ApiResponse<T> = { success: boolean; data?: T; error?: string }

type KnowledgeDocument = {
  id: number
  title: string
  pageCount?: number | null
  createdAt?: string
}

function asInt(input: unknown): number | null {
  const n = typeof input === 'string' ? parseInt(input, 10) : NaN
  return Number.isFinite(n) ? n : null
}

export function SpineKnowledgeDocPage() {
  // Route shape is /knowledge/doc/:docId/page/:pageNo
  const { docId: docIdRaw, pageNo: pageNoRaw } = useParams<{ docId: string; pageNo: string }>()
  const docId = asInt(docIdRaw)
  const pageNo = asInt(pageNoRaw)

  const [doc, setDoc] = useState<KnowledgeDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/knowledge/${docId}`, { credentials: 'include' })
        const json = (await res.json()) as ApiResponse<KnowledgeDocument>
        if (cancelled) return
        if (!res.ok || !json.success || !json.data) {
          setDoc(null)
          setError(json.error || `Failed to load document (HTTP ${res.status})`)
          return
        }
        setDoc(json.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load document')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [docId])

  const imageUrl = useMemo(() => {
    if (!docId || !pageNo) return null
    return `/api/knowledge/${docId}/pages/${pageNo}/image`
  }, [docId, pageNo])

  if (!docId || !pageNo) {
    return (
      <div className="detail-page">
        <div className="page-header">
          <h1>Knowledge</h1>
          <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Invalid document/page.</p>
        </div>
        <Link to="/knowledge" className="back-link">
          ← Back to Knowledge
        </Link>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>Knowledge</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          {doc ? doc.title : loading ? 'Loading…' : `Document ${docId}`} • p.{pageNo}
        </p>
      </div>

      <div className="detail-card">
        {error ? <div style={{ marginBottom: 10, color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

        {imageUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <img
              src={imageUrl}
              alt={`Document ${docId} page ${pageNo}`}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'white',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <Link className="btn-secondary" to={`/knowledge/doc/${docId}/page/${Math.max(1, pageNo - 1)}`}>
                ← Prev
              </Link>
              <Link className="btn-secondary" to={`/knowledge/doc/${docId}/page/${pageNo + 1}`}>
                Next →
              </Link>
            </div>
            {doc?.pageCount ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Page {pageNo} of {doc.pageCount}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Link to="/knowledge" className="back-link">
        ← Back to Knowledge
      </Link>
    </div>
  )
}


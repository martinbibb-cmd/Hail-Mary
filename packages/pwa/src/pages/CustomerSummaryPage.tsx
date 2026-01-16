import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSpineStore } from '../stores/spineStore'
import { safeCopyToClipboard } from '../utils/clipboard'
import './CustomerSummaryPage.css'

type ApiResponse<T> = { success: boolean; data?: T; error?: string; code?: string }

type CustomerSummaryResponse = {
  title: string
  summaryMarkdown: string
}

function markdownToPlainText(md: string): string {
  // Small, safe “good enough” conversion for clipboard.
  let s = md || ''
  s = s.replace(/```[\s\S]*?```/g, '') // fenced blocks
  s = s.replace(/`([^`]+)`/g, '$1') // inline code
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
  s = s.replace(/^#{1,6}\s+/gm, '') // headings
  s = s.replace(/^\s*[-*+]\s+/gm, '• ') // bullets
  s = s.replace(/^\s*\d+\.\s+/gm, '') // numbered lists
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1') // bold
  s = s.replace(/\*([^*]+)\*/g, '$1') // italics
  s = s.replace(/_([^_]+)_/g, '$1')
  s = s.replace(/\r\n/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

export function CustomerSummaryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeVisitId = useSpineStore((s) => s.activeVisitId)

  const visitId = useMemo(() => {
    const q = new URLSearchParams(location.search)
    return q.get('visitId') || activeVisitId || ''
  }, [activeVisitId, location.search])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runEngineerFirst, setRunEngineerFirst] = useState(false)
  const [title, setTitle] = useState('Customer summary')
  const [markdown, setMarkdown] = useState<string>('')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!visitId) {
      setError('No active visit. Start a visit first.')
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      setRunEngineerFirst(false)
      try {
        const res = await fetch('/api/customer/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ visitId, tone: 'calm' }),
        })
        const json = (await res.json()) as ApiResponse<CustomerSummaryResponse>
        if (cancelled) return

        if (!res.ok || !json.success || !json.data) {
          const code = json.code || ''
          if (res.status === 409 && code === 'run_engineer_first') {
            setRunEngineerFirst(true)
            setError('Run Engineer first to generate a customer summary.')
          } else {
            setError(json.error || `Failed to generate summary (HTTP ${res.status})`)
          }
          setMarkdown('')
          return
        }

        setTitle(json.data.title || 'Customer summary')
        setMarkdown(json.data.summaryMarkdown || '')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to generate summary')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [visitId])

  const copy = useCallback(async () => {
    if (!markdown) return
    setCopyStatus(null)
    const plain = markdownToPlainText(markdown)

    try {
      // Prefer writing both markdown + plain when supported.
      // ClipboardItem isn't available everywhere (esp. some iOS webviews).
      const ClipboardItemAny = (window as any).ClipboardItem as any
      const hasClipboardWrite = typeof navigator !== 'undefined' &&
                               navigator.clipboard &&
                               (navigator.clipboard as any).write &&
                               window.isSecureContext

      if (ClipboardItemAny && hasClipboardWrite) {
        try {
          const item = new ClipboardItemAny({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/markdown': new Blob([markdown], { type: 'text/markdown' }),
          })
          await (navigator.clipboard as any).write([item])
          setCopyStatus('Copied.')
          setTimeout(() => setCopyStatus(null), 1500)
          return
        } catch {
          // Fall through to safe clipboard method
        }
      }

      // Use safe clipboard method as fallback
      const result = await safeCopyToClipboard(plain)
      if (result.ok) {
        setCopyStatus('Copied.')
        setTimeout(() => setCopyStatus(null), 1500)
      } else {
        setCopyStatus(result.error)
        setTimeout(() => setCopyStatus(null), 2500)
      }
    } catch (e) {
      setCopyStatus(e instanceof Error ? e.message : 'Copy failed')
      setTimeout(() => setCopyStatus(null), 2500)
    }
  }, [markdown])

  const print = useCallback(() => {
    window.print()
  }, [])

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1 className="customer-summary__title">{title}</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          Customer-friendly summary (derived from the latest Engineer output only).
        </p>
      </div>

      <div className="detail-card">
        <div className="customer-summary__toolbar">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="btn-primary" onClick={copy} disabled={!markdown || loading}>
            Copy
          </button>
          <button className="btn-secondary" onClick={print} disabled={!markdown || loading}>
            Print / Save PDF
          </button>
          {copyStatus ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{copyStatus}</div> : null}
        </div>

        {loading ? <div style={{ color: 'var(--text-muted)' }}>Generating…</div> : null}
        {error ? <div style={{ marginBottom: 10, color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

        {runEngineerFirst ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/engineer" className="btn-primary">
              Run Engineer
            </Link>
            <Link to="/" className="btn-secondary">
              Back to Home
            </Link>
          </div>
        ) : null}

        {markdown ? (
          <div className="customer-summary__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : null}
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}


import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'

type SpineFeedEvent = {
  id: string
  type: string
  ts: string
  payload: any
  visit: { id: string }
}

type FeedResponse = { success: boolean; data?: SpineFeedEvent[]; error?: string }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ docId: string; title: string; ref: string }>
  kbEnabled?: boolean
  ts: number
}

const toStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  return input.filter((v) => typeof v === 'string' && v.trim()).map((v) => String(v).trim())
}

const safeSummary = (payload: any): string => {
  if (!payload || typeof payload !== 'object') return ''
  const s = (payload as any).summary
  return typeof s === 'string' ? s : ''
}

export function SpineSarahPage() {
  const activeProperty = useSpineStore((s) => s.activeProperty)
  const activeVisitId = useSpineStore((s) => s.activeVisitId)

  const [feed, setFeed] = useState<SpineFeedEvent[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (!activeVisitId) return
    let cancelled = false

    const run = async () => {
      setFeedLoading(true)
      setFeedError(null)
      try {
        const res = await fetch('/api/feed?limit=200', { credentials: 'include' })
        const json = (await res.json()) as FeedResponse
        if (cancelled) return
        if (json.success && Array.isArray(json.data)) setFeed(json.data)
        else setFeedError(json.error || 'Failed to load feed')
      } catch (e) {
        if (!cancelled) setFeedError(e instanceof Error ? e.message : 'Failed to load feed')
      } finally {
        if (!cancelled) setFeedLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [activeVisitId])

  const latestEngineerEvent = useMemo(() => {
    if (!activeVisitId) return null
    const candidates = feed.filter((e) => e.visit?.id === activeVisitId && e.type === 'engineer_output')
    if (candidates.length === 0) return null
    // feed is newest->oldest; first match is latest
    return candidates[0]
  }, [activeVisitId, feed])

  const disabledReason = useMemo(() => {
    if (!activeVisitId) return 'No active visit. Start a visit first (Property → Start visit, or take a photo to auto-create).'
    return null
  }, [activeVisitId])

  const engineerPayload = latestEngineerEvent?.payload && typeof latestEngineerEvent.payload === 'object' ? (latestEngineerEvent.payload as any) : null
  const engineerSummary = safeSummary(engineerPayload)
  const engineerFacts = engineerPayload ? toStringArray(engineerPayload.facts) : []
  const engineerQuestions = engineerPayload ? toStringArray(engineerPayload.questions) : []
  const engineerConcerns = engineerPayload ? toStringArray(engineerPayload.concerns) : []

  const send = useCallback(async () => {
    if (!activeVisitId) return
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch('/api/sarah/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ visitId: activeVisitId, message: text, useKnowledgeBase }),
      })
      const json = (await res.json()) as {
        reply?: string
        citations?: Array<{ docId: string; title: string; ref: string }>
        error?: string
      }
      if (!res.ok || !json.reply) throw new Error(json.error || 'Failed to get reply from Sarah')

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: json.reply,
        citations: Array.isArray(json.citations) ? json.citations : [],
        kbEnabled: useKnowledgeBase,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send message'
      setSendError(msg)
      const assistantMsg: ChatMessage = {
        id: `a-err-${Date.now()}`,
        role: 'assistant',
        content: `I couldn’t respond right now. ${msg}`,
        citations: [],
        kbEnabled: useKnowledgeBase,
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setSending(false)
    }
  }, [activeVisitId, input, useKnowledgeBase])

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>Sarah</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          Based on latest Engineer run (read-only guidance).
        </p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Active property: {activeProperty ? `${activeProperty.addressLine1} • ${activeProperty.postcode}` : 'None'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Active visit: {activeVisitId ?? 'None'}</div>
        </div>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Engineer (facts)</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {latestEngineerEvent ? `Latest event: ${new Date(latestEngineerEvent.ts).toLocaleString()}` : '—'}
          </div>
        </div>

        {feedLoading ? <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Loading visit feed…</div> : null}
        {feedError ? <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 13 }}>{feedError}</div> : null}

        {!latestEngineerEvent ? (
          <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>No Engineer output to display.</div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Summary</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{engineerSummary || '—'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Facts</div>
                {engineerFacts.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>None</div> : <ul>{engineerFacts.map((t, i) => <li key={`f-${i}`}>{t}</li>)}</ul>}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Open questions</div>
                {engineerQuestions.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>None</div> : <ul>{engineerQuestions.map((t, i) => <li key={`q-${i}`}>{t}</li>)}</ul>}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Concerns</div>
                {engineerConcerns.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>None</div> : <ul>{engineerConcerns.map((t, i) => <li key={`c-${i}`}>{t}</li>)}</ul>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>Sarah (conversation)</h2>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={useKnowledgeBase}
                onChange={(e) => setUseKnowledgeBase(e.target.checked)}
                disabled={sending}
              />
              Use Knowledge Base
            </label>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Advisory only • No timeline writes</div>
          </div>
        </div>

        {disabledReason ? (
          <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>{disabledReason}</div>
        ) : null}

        <div
          style={{
            marginTop: 10,
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            background: 'var(--panel)',
            minHeight: 180,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {messages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Ask: “What does the Engineer output mean?”, “What should I check next?”, or “What are the minimum clearances for model X?” (KB on).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: m.role === 'user' ? 'var(--primary)' : 'var(--panel-2)',
                    color: m.role === 'user' ? 'white' : 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{m.role === 'user' ? 'You' : 'Sarah'}</div>
                  <div>{m.content}</div>
                  {m.role === 'assistant' ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Sources</div>
                      {m.kbEnabled ? (
                        m.citations && m.citations.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {m.citations.map((c, idx) => (
                              <li key={`${m.id}-c-${idx}`}>
                                <span style={{ color: 'var(--text)' }}>{c.title}</span> <span>({c.ref})</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div>No sources found.</div>
                        )
                      ) : (
                        <div>Knowledge Base was off for this answer.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {sending ? <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Sarah is typing…</div> : null}
          <div ref={endRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sarah…"
            disabled={!!disabledReason || sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
            }}
          />
          <button className="btn-primary" onClick={send} disabled={!!disabledReason || sending || !input.trim()}>
            Send
          </button>
        </div>

        {sendError ? <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13 }}>{sendError}</div> : null}
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}


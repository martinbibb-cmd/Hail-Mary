import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'
import './PresentationPage.css'

type ApiResponse<T> = { success: boolean; data?: T; error?: string; code?: string }

type TimelineEvent = {
  id: string
  type: string
  ts: string
  payload: any
}

type VisitTimelineResponse = {
  visit: { id: string; propertyId: string; startedAt: string; endedAt?: string | null }
  property: { id: string; addressLine1: string; addressLine2?: string | null; town?: string | null; postcode: string }
  events: TimelineEvent[]
}

type PresentationDraft = {
  id: string
  visitId: string
  title: string
  sections: any
  selectedPhotoEventIds: string[]
  selectedAssetIds: string[]
  createdAt: string
}

type MediaAsset = {
  id: string
  kind: 'image' | 'video' | string
  title: string
  description?: string | null
  tags: string[]
  url: string
  thumbUrl?: string | null
  createdAt: string
}

type PackSectionId =
  | 'header'
  | 'executive_summary'
  | 'what_we_saw'
  | 'what_we_recommend'
  | 'what_we_need_to_confirm'
  | 'risks_constraints'
  | 'how_it_works'
  | 'next_steps'

type PackSectionsV1 = {
  version: 1
  order: PackSectionId[]
  hidden: Partial<Record<PackSectionId, boolean>>
  options: {
    showSources?: boolean
    photoCaptions?: Record<string, string>
    nextSteps?: string[]
  }
}

const DEFAULT_SECTION_ORDER: PackSectionId[] = [
  'header',
  'executive_summary',
  'what_we_saw',
  'what_we_recommend',
  'what_we_need_to_confirm',
  'risks_constraints',
  'how_it_works',
  'next_steps',
]

const SECTION_LABELS: Record<PackSectionId, string> = {
  header: 'Header',
  executive_summary: 'Executive summary',
  what_we_saw: 'What we saw on site',
  what_we_recommend: 'What we recommend',
  what_we_need_to_confirm: 'What we need to confirm',
  risks_constraints: 'Risks / constraints',
  how_it_works: 'How it works (media)',
  next_steps: 'Next steps',
}

const defaultSections = (): PackSectionsV1 => ({
  version: 1,
  order: [...DEFAULT_SECTION_ORDER],
  hidden: {},
  options: {
    showSources: false,
    photoCaptions: {},
    nextSteps: [
      'Confirm survey notes and any measurements.',
      'We’ll prepare your quote and options.',
      'Agree an installation date that suits you.',
      'Installation, commissioning, and handover.',
      'Aftercare: support, warranty paperwork, and any follow‑up questions.',
    ],
  },
})

function coerceSections(input: any): PackSectionsV1 {
  if (!input || typeof input !== 'object') return defaultSections()
  const version = input.version === 1 ? 1 : 1
  const orderRaw: unknown = input.order
  const order =
    Array.isArray(orderRaw) && orderRaw.length > 0
      ? (orderRaw.filter((x) => typeof x === 'string' && x in SECTION_LABELS) as PackSectionId[])
      : [...DEFAULT_SECTION_ORDER]
  const hiddenRaw: unknown = input.hidden
  const hidden: PackSectionsV1['hidden'] =
    hiddenRaw && typeof hiddenRaw === 'object' && !Array.isArray(hiddenRaw) ? (hiddenRaw as any) : {}
  const optionsRaw: unknown = input.options
  const options: PackSectionsV1['options'] =
    optionsRaw && typeof optionsRaw === 'object' && !Array.isArray(optionsRaw) ? (optionsRaw as any) : {}

  return {
    version,
    order: Array.from(new Set(order)).filter((x) => x in SECTION_LABELS) as PackSectionId[],
    hidden,
    options: {
      showSources: !!options.showSources,
      photoCaptions: options.photoCaptions && typeof options.photoCaptions === 'object' ? (options.photoCaptions as any) : {},
      nextSteps: Array.isArray(options.nextSteps) ? options.nextSteps.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 20) : defaultSections().options.nextSteps,
    },
  }
}

function formatVisitDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function safeText(s: unknown): string {
  return typeof s === 'string' ? s.trim() : ''
}

export function PresentationPage() {
  const navigate = useNavigate()
  const activeVisitId = useSpineStore((s) => s.activeVisitId)

  const [timeline, setTimeline] = useState<VisitTimelineResponse | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  const [drafts, setDrafts] = useState<PresentationDraft[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const activeDraft = useMemo(() => drafts.find((d) => d.id === activeDraftId) ?? null, [drafts, activeDraftId])

  const [sections, setSections] = useState<PackSectionsV1>(() => defaultSections())

  const [mediaQuery, setMediaQuery] = useState('')
  const [mediaTag, setMediaTag] = useState('')
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [mediaResults, setMediaResults] = useState<MediaAsset[]>([])
  const mediaCacheRef = useRef<Map<string, MediaAsset>>(new Map())

  const saveTimerRef = useRef<number | null>(null)
  const lastSavedRef = useRef<string>('')

  const photoEvents = useMemo(() => {
    const events = timeline?.events ?? []
    return events
      .filter((e) => e.type === 'photo' && e.payload && typeof e.payload === 'object' && typeof e.payload.imageUrl === 'string')
      .map((e) => ({
        id: e.id,
        ts: e.ts,
        imageUrl: String(e.payload.imageUrl),
        caption: safeText(e.payload.caption),
      }))
  }, [timeline?.events])

  const engineerOutput = useMemo(() => {
    const events = timeline?.events ?? []
    const out = events
      .filter((e) => e.type === 'engineer_output')
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0]
    return out?.payload && typeof out.payload === 'object' ? (out.payload as any) : null
  }, [timeline?.events])

  const selectedPhotos = useMemo(() => {
    const selected = new Set(activeDraft?.selectedPhotoEventIds ?? [])
    return photoEvents.filter((p) => selected.has(p.id))
  }, [activeDraft?.selectedPhotoEventIds, photoEvents])

  const selectedAssets = useMemo(() => {
    const ids = activeDraft?.selectedAssetIds ?? []
    return ids.map((id) => mediaCacheRef.current.get(id)).filter(Boolean) as MediaAsset[]
  }, [activeDraft?.selectedAssetIds, mediaResults])

  const canBuild = !!activeVisitId

  // Load visit timeline (photos + engineer_output) for active visit
  useEffect(() => {
    if (!activeVisitId) {
      setTimeline(null)
      setTimelineError(null)
      return
    }
    let cancelled = false
    setTimelineLoading(true)
    setTimelineError(null)
    fetch(`/api/visits/${encodeURIComponent(activeVisitId)}/timeline?types=photo,engineer_output`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: ApiResponse<VisitTimelineResponse>) => {
        if (cancelled) return
        if (json.success && json.data) setTimeline(json.data)
        else setTimelineError(json.error || 'Failed to load visit timeline')
      })
      .catch((e) => {
        if (!cancelled) setTimelineError(e instanceof Error ? e.message : 'Failed to load visit timeline')
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeVisitId])

  // Load drafts for active visit
  useEffect(() => {
    if (!activeVisitId) {
      setDrafts([])
      setActiveDraftId(null)
      setDraftError(null)
      return
    }
    let cancelled = false
    setDraftLoading(true)
    setDraftError(null)
    fetch(`/api/presentation/drafts?visitId=${encodeURIComponent(activeVisitId)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: ApiResponse<PresentationDraft[]>) => {
        if (cancelled) return
        const list = Array.isArray(json.data) ? json.data : []
        setDrafts(list)
        setActiveDraftId((prev) => {
          if (prev && list.some((d) => d.id === prev)) return prev
          return list[0]?.id ?? null
        })
      })
      .catch((e) => {
        if (!cancelled) setDraftError(e instanceof Error ? e.message : 'Failed to load drafts')
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeVisitId])

  // Sync sections state from active draft
  useEffect(() => {
    if (!activeDraft) return
    setSections(coerceSections(activeDraft.sections))
  }, [activeDraft?.id])

  // Load admin media (cached)
  useEffect(() => {
    let cancelled = false
    setMediaLoading(true)
    setMediaError(null)
    const q = mediaQuery.trim()
    const tag = mediaTag.trim()
    const url = `/api/admin/media?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((json: ApiResponse<MediaAsset[]>) => {
        if (cancelled) return
        const items = Array.isArray(json.data) ? json.data : []
        setMediaResults(items)
        for (const a of items) mediaCacheRef.current.set(a.id, a)
      })
      .catch((e) => {
        if (!cancelled) setMediaError(e instanceof Error ? e.message : 'Failed to load media')
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mediaQuery, mediaTag])

  const queueSave = (patch: Partial<Pick<PresentationDraft, 'title' | 'sections' | 'selectedPhotoEventIds' | 'selectedAssetIds'>>) => {
    if (!activeDraft) return
    const next = { ...activeDraft, ...patch }
    const signature = JSON.stringify({
      id: activeDraft.id,
      title: next.title,
      sections: next.sections,
      selectedPhotoEventIds: next.selectedPhotoEventIds,
      selectedAssetIds: next.selectedAssetIds,
    })
    if (signature === lastSavedRef.current) return

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/presentation/drafts/${encodeURIComponent(activeDraft.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch),
        })
        const json = (await res.json()) as ApiResponse<PresentationDraft>
        if (!res.ok || !json.success || !json.data) throw new Error(json.error || 'Failed to save draft')
        lastSavedRef.current = signature
        setDrafts((prev) => prev.map((d) => (d.id === json.data!.id ? json.data! : d)))
      } catch (e) {
        // Keep UI usable; user can retry.
        console.warn('Draft autosave failed:', e)
      }
    }, 600)
  }

  const createDraft = async () => {
    if (!activeVisitId) return
    setDraftError(null)
    try {
      const res = await fetch('/api/presentation/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          visitId: activeVisitId,
          title: 'Customer Pack',
          sections: defaultSections(),
          selectedPhotoEventIds: [],
          selectedAssetIds: [],
        }),
      })
      const json = (await res.json()) as ApiResponse<PresentationDraft>
      if (!res.ok || !json.success || !json.data) throw new Error(json.error || 'Failed to create draft')
      setDrafts((prev) => [json.data!, ...prev])
      setActiveDraftId(json.data!.id)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Failed to create draft')
    }
  }

  const togglePhoto = (photoId: string) => {
    if (!activeDraft) return
    const set = new Set(activeDraft.selectedPhotoEventIds ?? [])
    if (set.has(photoId)) set.delete(photoId)
    else set.add(photoId)
    const next = Array.from(set)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft.id ? { ...d, selectedPhotoEventIds: next } : d)))
    queueSave({ selectedPhotoEventIds: next })
  }

  const setPhotoCaptionOverride = (photoEventId: string, caption: string) => {
    const nextSections: PackSectionsV1 = {
      ...sections,
      options: {
        ...sections.options,
        photoCaptions: {
          ...(sections.options.photoCaptions ?? {}),
          [photoEventId]: caption,
        },
      },
    }
    setSections(nextSections)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft?.id ? { ...d, sections: nextSections } : d)))
    queueSave({ sections: nextSections })
  }

  const toggleAsset = (assetId: string) => {
    if (!activeDraft) return
    const set = new Set(activeDraft.selectedAssetIds ?? [])
    if (set.has(assetId)) set.delete(assetId)
    else set.add(assetId)
    const next = Array.from(set)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft.id ? { ...d, selectedAssetIds: next } : d)))
    queueSave({ selectedAssetIds: next })
  }

  const toggleSectionVisibility = (id: PackSectionId) => {
    const hidden = { ...(sections.hidden ?? {}) }
    hidden[id] = !hidden[id]
    const next = { ...sections, hidden }
    setSections(next)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft?.id ? { ...d, sections: next } : d)))
    queueSave({ sections: next })
  }

  const moveSection = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= sections.order.length) return
    const nextOrder = moveItem(sections.order, idx, nextIdx)
    const next = { ...sections, order: nextOrder }
    setSections(next)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft?.id ? { ...d, sections: next } : d)))
    queueSave({ sections: next })
  }

  const setShowSources = (v: boolean) => {
    const next = { ...sections, options: { ...sections.options, showSources: v } }
    setSections(next)
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft?.id ? { ...d, sections: next } : d)))
    queueSave({ sections: next })
  }

  const titleChange = (v: string) => {
    if (!activeDraft) return
    const nextTitle = v
    setDrafts((prev) => prev.map((d) => (d.id === activeDraft.id ? { ...d, title: nextTitle } : d)))
    queueSave({ title: nextTitle })
  }

  const packHeaderAddress = timeline?.property?.addressLine1?.trim()
    ? `${timeline.property.addressLine1}, ${timeline.property.postcode}`
    : timeline?.property?.postcode
      ? `Property in ${timeline.property.postcode}`
      : 'Property'

  const visitDate = formatVisitDate(timeline?.visit?.startedAt)

  const photoCaption = (id: string, fallback: string) => {
    const override = sections.options.photoCaptions?.[id]
    return override !== undefined ? override : fallback
  }

  const renderSection = (id: PackSectionId) => {
    if (sections.hidden?.[id]) return null

    if (id === 'header') {
      return (
        <section className="pack-section">
          <div className="pack-header">
            <div className="pack-title">{activeDraft?.title || 'Customer Pack'}</div>
            <div className="pack-sub">{packHeaderAddress}</div>
            <div className="pack-meta">
              <div>Visit date: {visitDate || '—'}</div>
              <div>Prepared by Atlas</div>
            </div>
          </div>
        </section>
      )
    }

    if (id === 'executive_summary') {
      return (
        <section className="pack-section">
          <h2>Executive summary</h2>
          <p className="pack-paragraph">{safeText(engineerOutput?.summary) || '—'}</p>
        </section>
      )
    }

    if (id === 'what_we_saw') {
      return (
        <section className="pack-section">
          <h2>What we saw on site</h2>
          {selectedPhotos.length === 0 ? (
            <div className="pack-muted">No photos selected yet.</div>
          ) : (
            <div className="pack-photo-grid">
              {selectedPhotos.map((p) => (
                <figure key={p.id} className="pack-photo">
                  <img src={p.imageUrl} alt={photoCaption(p.id, p.caption) || 'Site photo'} />
                  <figcaption>{photoCaption(p.id, p.caption) || ' '}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )
    }

    if (id === 'what_we_recommend') {
      const factsRaw: any[] = Array.isArray(engineerOutput?.facts) ? engineerOutput.facts : []
      const facts = factsRaw
        .map((f) => (typeof f === 'string' ? { text: f, citations: [] } : f))
        .filter((f) => f && typeof f === 'object' && typeof f.text === 'string')
        .slice(0, 20)

      return (
        <section className="pack-section">
          <div className="pack-row">
            <h2>What we recommend</h2>
            <label className="pack-toggle">
              <input
                type="checkbox"
                checked={!!sections.options.showSources}
                onChange={(e) => setShowSources(e.target.checked)}
              />
              <span>Show sources</span>
            </label>
          </div>
          {facts.length === 0 ? (
            <div className="pack-muted">—</div>
          ) : (
            <ul className="pack-bullets">
              {facts.map((f, idx) => (
                <li key={`fact-${idx}`}>
                  <div>{safeText(f.text) || '—'}</div>
                  {sections.options.showSources ? (
                    <div className="pack-sources">
                      {Array.isArray(f.citations) && f.citations.length > 0 ? (
                        <ul>
                          {f.citations.slice(0, 6).map((c: any, cIdx: number) => (
                            <li key={`c-${idx}-${cIdx}`}>
                              {safeText(c.title) ? <span className="pack-source-title">{safeText(c.title)}</span> : null}
                              {safeText(c.ref) ? <span className="pack-source-ref"> — {safeText(c.ref)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="pack-muted">No sources provided.</span>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )
    }

    if (id === 'what_we_need_to_confirm') {
      const questions: string[] = Array.isArray(engineerOutput?.questions)
        ? engineerOutput.questions.filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 20)
        : []
      return (
        <section className="pack-section">
          <h2>What we need to confirm</h2>
          {questions.length === 0 ? <div className="pack-muted">—</div> : <ul className="pack-bullets">{questions.map((q, i) => <li key={`q-${i}`}>{q}</li>)}</ul>}
        </section>
      )
    }

    if (id === 'risks_constraints') {
      const concerns: string[] = Array.isArray(engineerOutput?.concerns)
        ? engineerOutput.concerns.filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 20)
        : []
      return (
        <section className="pack-section">
          <h2>Risks / constraints</h2>
          {concerns.length === 0 ? <div className="pack-muted">—</div> : <ul className="pack-bullets">{concerns.map((q, i) => <li key={`c-${i}`}>{q}</li>)}</ul>}
        </section>
      )
    }

    if (id === 'how_it_works') {
      return (
        <section className="pack-section">
          <h2>How it works</h2>
          {selectedAssets.length === 0 ? (
            <div className="pack-muted">No reusable media selected yet.</div>
          ) : (
            <div className="pack-media-grid">
              {selectedAssets.map((a) => (
                <figure key={a.id} className="pack-media">
                  {a.kind === 'video' ? (
                    <>
                      <img src={a.thumbUrl || a.url} alt={a.title} />
                      <figcaption>
                        <div className="pack-media-title">{a.title}</div>
                        <div className="pack-muted">
                          Video: <a href={a.url}>{a.url}</a>
                        </div>
                      </figcaption>
                    </>
                  ) : (
                    <>
                      <img src={a.thumbUrl || a.url} alt={a.title} />
                      <figcaption>
                        <div className="pack-media-title">{a.title}</div>
                        {a.description ? <div className="pack-muted">{a.description}</div> : null}
                      </figcaption>
                    </>
                  )}
                </figure>
              ))}
            </div>
          )}
        </section>
      )
    }

    if (id === 'next_steps') {
      const steps = sections.options.nextSteps ?? defaultSections().options.nextSteps ?? []
      return (
        <section className="pack-section">
          <h2>Next steps</h2>
          <ol className="pack-steps">
            {steps.map((s, idx) => (
              <li key={`step-${idx}`}>{s}</li>
            ))}
          </ol>
        </section>
      )
    }

    return null
  }

  return (
    <div className="presentation-builder">
      <div className="presentation-top">
        <div>
          <h1 className="presentation-title">Presentation</h1>
          <div className="presentation-sub">
            {activeVisitId ? (
              <span>
                Visit: <span className="mono">{activeVisitId}</span>
              </span>
            ) : (
              <span>No active visit selected</span>
            )}
          </div>
        </div>
        <div className="presentation-actions">
          <button className="btn-secondary" onClick={() => navigate('/')} type="button">
            Home
          </button>
          <button className="btn-primary" onClick={() => window.print()} type="button" disabled={!activeDraft || !engineerOutput}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {!canBuild ? (
        <div className="presentation-empty">
          <div className="presentation-empty__card">
            <h2>Pick a property first</h2>
            <p>Go to Home → select a property to create/select an active visit.</p>
            <button className="btn-primary" onClick={() => navigate('/')} type="button">
              Go to Home
            </button>
          </div>
        </div>
      ) : (
        <div className="presentation-grid">
          <div className="presentation-panel">
            <h2>Draft</h2>
            {draftLoading ? <div className="presentation-muted">Loading…</div> : null}
            {draftError ? <div className="presentation-error">{draftError}</div> : null}

            <div className="presentation-row">
              <button className="btn-primary" onClick={createDraft} type="button" disabled={!activeVisitId}>
                Create new draft
              </button>
            </div>

            <label className="presentation-label">
              Load existing
              <select
                value={activeDraftId ?? ''}
                onChange={(e) => setActiveDraftId(e.target.value || null)}
                disabled={drafts.length === 0}
              >
                {drafts.length === 0 ? <option value="">No drafts yet</option> : null}
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || 'Customer Pack'} — {new Date(d.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>

            <label className="presentation-label">
              Title
              <input value={activeDraft?.title ?? ''} onChange={(e) => titleChange(e.target.value)} disabled={!activeDraft} />
            </label>
          </div>

          <div className="presentation-panel">
            <h2>Pick site photos</h2>
            {timelineLoading ? <div className="presentation-muted">Loading photos…</div> : null}
            {timelineError ? <div className="presentation-error">{timelineError}</div> : null}

            {!engineerOutput ? (
              <div className="presentation-block">
                <div className="presentation-block__title">Run Engineer first</div>
                <div className="presentation-muted">This pack can only present existing Engineer outputs (no new facts).</div>
                <button className="btn-primary" type="button" onClick={() => navigate('/engineer')}>
                  Go to Engineer
                </button>
              </div>
            ) : null}

            <div className="presentation-photo-grid">
              {photoEvents.length === 0 ? <div className="presentation-muted">No photos found for this visit.</div> : null}
              {photoEvents.map((p) => {
                const checked = (activeDraft?.selectedPhotoEventIds ?? []).includes(p.id)
                return (
                  <div key={p.id} className={`presentation-photo ${checked ? 'presentation-photo--selected' : ''}`}>
                    <label className="presentation-photo__check">
                      <input type="checkbox" checked={checked} onChange={() => togglePhoto(p.id)} disabled={!activeDraft} />
                      <span>Select</span>
                    </label>
                    <img src={p.imageUrl} alt="Site photo" />
                    <div className="presentation-photo__meta">
                      <div className="presentation-muted">{new Date(p.ts).toLocaleString()}</div>
                      <label className="presentation-caption">
                        Caption (override)
                        <input
                          value={photoCaption(p.id, p.caption) || ''}
                          onChange={(e) => setPhotoCaptionOverride(p.id, e.target.value)}
                          disabled={!activeDraft || !checked}
                          placeholder={p.caption || 'Optional'}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="presentation-panel">
            <h2>Pick reusable media</h2>
            <div className="presentation-row">
              <input
                value={mediaQuery}
                onChange={(e) => setMediaQuery(e.target.value)}
                placeholder="Search (title/description)…"
              />
              <input value={mediaTag} onChange={(e) => setMediaTag(e.target.value)} placeholder="Tag…" />
            </div>
            {mediaLoading ? <div className="presentation-muted">Loading media…</div> : null}
            {mediaError ? <div className="presentation-error">{mediaError}</div> : null}

            <div className="presentation-media-grid">
              {mediaResults.length === 0 && !mediaLoading ? <div className="presentation-muted">No media found.</div> : null}
              {mediaResults.map((a) => {
                const checked = (activeDraft?.selectedAssetIds ?? []).includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`presentation-media ${checked ? 'presentation-media--selected' : ''}`}
                    onClick={() => toggleAsset(a.id)}
                    disabled={!activeDraft}
                  >
                    <img src={a.thumbUrl || a.url} alt={a.title} />
                    <div className="presentation-media__title">{a.title}</div>
                    <div className="presentation-muted">{a.kind}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="presentation-panel">
            <h2>Sections</h2>
            <div className="presentation-section-list">
              {sections.order.map((id, idx) => {
                const hidden = !!sections.hidden?.[id]
                return (
                  <div key={id} className="presentation-section-item">
                    <div className="presentation-section-left">
                      <div className="presentation-section-title">{SECTION_LABELS[id]}</div>
                      <label className="presentation-toggle">
                        <input type="checkbox" checked={!hidden} onChange={() => toggleSectionVisibility(id)} />
                        <span>Visible</span>
                      </label>
                    </div>
                    <div className="presentation-section-actions">
                      <button type="button" className="btn-secondary" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => moveSection(idx, 1)}
                        disabled={idx === sections.order.length - 1}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="presentation-preview-wrap">
            <div className="presentation-panel presentation-preview-actions">
              <h2>Preview</h2>
              <div className="presentation-muted">Print‑friendly preview of the customer pack.</div>
            </div>
            <article className="pack-preview" aria-label="Customer pack preview">
              {sections.order.map((id) => (
                <React.Fragment key={id}>{renderSection(id)}</React.Fragment>
              ))}
            </article>
          </div>
        </div>
      )}
    </div>
  )
}


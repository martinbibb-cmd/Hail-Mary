import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LayoutMode } from '../hooks/useLayoutMode';
import { useSpineStore } from '../stores/spineStore';
import './HomePage.css';

interface HomePageProps {
  layout: LayoutMode;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SpineProperty {
  id: string;
  addressLine1: string;
  addressLine2?: string | null;
  town?: string | null;
  postcode: string;
}

interface SpineFeedEvent {
  id: string;
  type: string;
  ts: string;
  payload: any;
  geo?: any;
  property: SpineProperty;
  visit: {
    id: string;
    propertyId: string;
    startedAt: string;
    endedAt?: string | null;
  };
}

const eventTypeIcon = (type: string): string => {
  switch (type) {
    case 'note':
      return '📝';
    case 'photo':
      return '📷';
    case 'transcript':
      return '🗣️';
    case 'measurement':
      return '📏';
    case 'engineer_output':
      return '🛠️';
    case 'engineer_diff':
      return '🔁';
    case 'knowledge_ref':
      return '📚';
    default:
      return '🕒';
  }
};

const truncate = (s: string, max = 140) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

const toStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input.filter((v) => typeof v === 'string' && v.trim()).map((v) => String(v).trim());
};

type EngineerFactCitation = { docId: string; title: string; ref: string };
type EngineerFactConfidence = 'high' | 'medium' | 'low';
type EngineerFact = { text: string; citations: EngineerFactCitation[]; verified?: boolean; confidence?: EngineerFactConfidence };
type EngineerDiffPayload = {
  addedFacts: string[];
  removedFacts: string[];
  resolvedQuestions: string[];
  newConcerns: string[];
  summary: string;
};

const toEngineerFacts = (input: unknown): EngineerFact[] => {
  if (!Array.isArray(input)) return [];

  const out: EngineerFact[] = [];
  for (const v of input) {
    if (typeof v === 'string' && v.trim()) {
      out.push({ text: v.trim(), citations: [], verified: false });
      continue;
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const obj = v as any;
    const text = typeof obj.text === 'string' ? obj.text.trim() : '';
    if (!text) continue;
    const citationsRaw = Array.isArray(obj.citations) ? obj.citations : [];
    const citations: EngineerFactCitation[] = citationsRaw
      .filter((c: any) => c && typeof c === 'object' && !Array.isArray(c))
      .map(
        (c: any): EngineerFactCitation => ({
        docId: typeof c.docId === 'string' ? c.docId : String(c.docId ?? ''),
        title: typeof c.title === 'string' ? c.title : String(c.title ?? ''),
        ref: typeof c.ref === 'string' ? c.ref : String(c.ref ?? ''),
        })
      )
      .filter((c: EngineerFactCitation) => c.docId.trim() && c.title.trim() && c.ref.trim());

    const verified = typeof obj.verified === 'boolean' ? obj.verified : undefined;
    const confidence: EngineerFactConfidence | undefined = obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low' ? obj.confidence : undefined;

    out.push({ text, citations, verified, confidence });
  }
  return out;
};

const renderEngineerSection = (title: string, items: string[]) => {
  return (
    <div className="home-engineer__section">
      <div className="home-engineer__label">{title}</div>
      {items.length === 0 ? (
        <div className="home-engineer__empty">None</div>
      ) : (
        <ul className="home-engineer__list">
          {items.map((t, idx) => (
            <li key={`${title}-${idx}`} className="home-engineer__li">
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const renderEngineerFactsSection = (facts: EngineerFact[]) => {
  return (
    <div className="home-engineer__section">
      <div className="home-engineer__label">Facts</div>
      {facts.length === 0 ? (
        <div className="home-engineer__empty">None</div>
      ) : (
        <ul className="home-engineer__list">
          {facts.map((f, idx) => (
            <li key={`fact-${idx}`} className="home-engineer__li">
              <div className="home-engineer__fact-text">{f.text}</div>
              <details className="home-engineer__sources">
                <summary className="home-engineer__sources-summary">
                  Sources{f.citations.length > 0 ? ` (${f.citations.length})` : ''}
                </summary>
                {f.citations.length === 0 ? (
                  <div className="home-engineer__sources-empty">No sources.</div>
                ) : (
                  <ul className="home-engineer__sources-list">
                    {f.citations.map((c, cIdx) => (
                      <li key={`fact-${idx}-c-${cIdx}`} className="home-engineer__sources-li">
                        <span className="home-engineer__sources-title">{c.title}</span>{' '}
                        <span className="home-engineer__sources-ref">{c.ref}</span>{' '}
                        <span className="home-engineer__sources-docid">({c.docId})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const summarizePayload = (_type: string, payload: any): string => {
  if (payload == null) return '';
  if (typeof payload === 'string') return truncate(payload);
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (Array.isArray(payload)) return truncate(JSON.stringify(payload));
  if (typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const preferredKeys = ['summary', 'text', 'note', 'caption', 'title', 'name', 'value', 'result'];
    for (const k of preferredKeys) {
      const v = p[k];
      if (typeof v === 'string' && v.trim()) return truncate(v.trim());
    }
    if (typeof p.url === 'string') return truncate(p.url);
    try {
      return truncate(JSON.stringify(payload));
    } catch {
      return '';
    }
  }
  return truncate(String(payload));
};

export const HomePage: React.FC<HomePageProps> = ({ layout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const setActiveAddress = useSpineStore((s) => s.setActiveAddress);
  const setActiveVisitId = useSpineStore((s) => s.setActiveVisitId);
  const activeVisitId = useSpineStore((s) => s.activeVisitId);

  const isDesktop = layout === 'desktop';

  // v2 spine: All Activity feed
  const [feed, setFeed] = useState<SpineFeedEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [highlightEventId, setHighlightEventId] = useState<string | null>(() => {
    const s = (location.state as any)?.highlightEventId;
    return typeof s === 'string' && s.trim() ? s.trim() : null;
  });

  useEffect(() => {
    const s = (location.state as any)?.highlightEventId;
    if (typeof s === 'string' && s.trim()) setHighlightEventId(s.trim());
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setFeedLoading(true);
      setFeedError(null);
      try {
        const res = await fetch('/api/feed?limit=50', { credentials: 'include' });
        const json = (await res.json()) as ApiResponse<SpineFeedEvent[]>;
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setFeed(json.data);
        } else {
          setFeedError(json.error || 'Failed to load feed');
        }
      } catch (e) {
        if (!cancelled) setFeedError(e instanceof Error ? e.message : 'Failed to load feed');
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!highlightEventId) return;
    if (feedLoading) return;
    if (!feed.some((e) => e.id === highlightEventId)) return;

    // Allow DOM paint before scroll
    const handle = window.setTimeout(() => {
      const el = document.getElementById(`spine-event-${highlightEventId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);

    const clear = window.setTimeout(() => setHighlightEventId(null), 5000);
    return () => {
      window.clearTimeout(handle);
      window.clearTimeout(clear);
    };
  }, [feed, feedLoading, highlightEventId]);

  const feedByDay = useMemo(() => {
    const groups: Record<string, SpineFeedEvent[]> = {};
    for (const e of feed) {
      const day = new Date(e.ts).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      groups[day] = groups[day] ? [...groups[day], e] : [e];
    }
    return Object.entries(groups);
  }, [feed]);

  const latestEngineerOutputEventIdByVisit = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of feed) {
      const visitId = e.visit?.id;
      if (!visitId) continue;
      if (e.type !== 'engineer_output') continue;
      if (!map.has(visitId)) map.set(visitId, e.id);
    }
    return map;
  }, [feed]);

  const latestEngineerEventIdForActiveVisit = useMemo(() => {
    if (!activeVisitId) return null;
    return latestEngineerOutputEventIdByVisit.get(activeVisitId) ?? null;
  }, [activeVisitId, latestEngineerOutputEventIdByVisit]);

  // v2 spine: Postcode-first property search (accelerator)
  const [postcodeQuery, setPostcodeQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<SpineProperty[]>([]);
  const [propertyLoading, setPropertyLoading] = useState(false);

  // v2 spine: Add property modal (minimal fields)
  const [addOpen, setAddOpen] = useState(false);
  const [addPostcode, setAddPostcode] = useState('');
  const [addAddressLine1, setAddAddressLine1] = useState('');
  const [addTown, setAddTown] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const q = postcodeQuery.trim();
    if (!q) {
      setPropertyResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      setPropertyLoading(true);
      try {
        const res = await fetch(`/api/properties?postcode=${encodeURIComponent(q)}`, { credentials: 'include' });
        const json = (await res.json()) as ApiResponse<SpineProperty[]>;
        if (json.success && Array.isArray(json.data)) setPropertyResults(json.data);
        else setPropertyResults([]);
      } catch {
        setPropertyResults([]);
      } finally {
        setPropertyLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [postcodeQuery]);

  const createVisitForProperty = async (propertyId: string): Promise<string> => {
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ propertyId }),
    });
    const json = (await res.json()) as ApiResponse<{ id: string }>;
    if (!res.ok || !json.success || !json.data?.id) {
      throw new Error(json.error || 'Failed to create visit');
    }
    return json.data.id;
  };

  const selectPropertyAndCreateVisit = async (p: SpineProperty) => {
    setActiveAddress({
      id: p.id,
      line1: p.addressLine1,
      line2: p.addressLine2,
      town: p.town,
      postcode: p.postcode,
    });

    const visitId = await createVisitForProperty(p.id);
    setActiveVisitId(visitId);
  };

  const openAddModal = () => {
    setAddError(null);
    setAddPostcode(postcodeQuery.trim());
    setAddAddressLine1('');
    setAddTown('');
    setAddOpen(true);
  };

  const submitAddProperty = async () => {
    const postcode = addPostcode.trim();
    const addressLine1 = addAddressLine1.trim();
    const town = addTown.trim();
    if (!postcode || !addressLine1) {
      setAddError('Postcode and Address line 1 are required.');
      return;
    }

    setAddSaving(true);
    setAddError(null);
    try {
      const propRes = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          postcode,
          addressLine1,
          town: town || null,
        }),
      });
      const propJson = (await propRes.json()) as ApiResponse<SpineProperty>;
      if (!propRes.ok || !propJson.success || !propJson.data) {
        throw new Error(propJson.error || 'Failed to create property');
      }

      const created = propJson.data;

      // Optimistic: keep results fresh for current query
      const q = postcodeQuery.trim();
      if (q) {
        setPropertyResults((prev) => {
          const withoutDup = prev.filter((x) => x.id !== created.id);
          return [created, ...withoutDup];
        });
      }

      await selectPropertyAndCreateVisit(created);
      setAddOpen(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to create property');
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero__text">
          <p className="home-hero__eyebrow">v2 spine</p>
          <h1 className="home-hero__title">Home</h1>
        </div>
      </div>

      <div className={`home-grid ${isDesktop ? 'home-grid--desktop' : 'home-grid--stacked'}`}>
        <section className={`home-section home-section--full`}>
          <div className="home-section__header">
            <div className="home-section__header-row">
              <div>
                <h2>Property</h2>
                <p>Postcode-first: search existing or add a new one.</p>
              </div>
              <button className="home-properties__btn home-properties__btn--primary" onClick={openAddModal}>
                Add property
              </button>
            </div>
          </div>

          <div className="home-postcode">
            <input
              className="home-postcode__input"
              value={postcodeQuery}
              onChange={(e) => setPostcodeQuery(e.target.value)}
              placeholder="Enter postcode (e.g. SW1A1AA)…"
            />
            {propertyLoading ? <div className="home-postcode__hint">Searching…</div> : null}
          </div>

          {postcodeQuery.trim() && !propertyLoading && propertyResults.length === 0 ? (
            <div className="home-postcode__hint">No matching properties.</div>
          ) : null}

          {propertyResults.length > 0 ? (
            <div className="home-properties">
              {propertyResults.map((p) => (
                <div key={p.id} className="home-properties__item">
                  <div className="home-properties__info">
                    <div className="home-properties__title">{p.addressLine1}</div>
                    <div className="home-properties__sub">
                      {p.town ? `${p.town} • ` : ''}
                      {p.postcode}
                    </div>
                  </div>
                  <div className="home-properties__actions">
                    <button className="home-properties__btn" onClick={() => navigate(`/properties/${p.id}`)}>
                      Open property
                    </button>
                    <button
                      className="home-properties__btn home-properties__btn--primary"
                      onClick={() =>
                        selectPropertyAndCreateVisit(p).catch((e) => {
                          alert(e instanceof Error ? e.message : 'Failed to select property');
                        })
                      }
                    >
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {addOpen ? (
          <div className="home-modal">
            <div className="home-modal__overlay" onClick={() => (!addSaving ? setAddOpen(false) : null)} />
            <div className="home-modal__card" role="dialog" aria-modal="true" aria-label="Add property">
              <div className="home-modal__header">
                <div className="home-modal__title">Add property</div>
                <button className="home-modal__close" onClick={() => setAddOpen(false)} disabled={addSaving} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="home-modal__body">
                <label className="home-modal__label">
                  Postcode *
                  <input value={addPostcode} onChange={(e) => setAddPostcode(e.target.value)} placeholder="e.g. SW1A 1AA" />
                </label>
                <label className="home-modal__label">
                  Address line 1 *
                  <input value={addAddressLine1} onChange={(e) => setAddAddressLine1(e.target.value)} placeholder="e.g. 10 Downing St" />
                </label>
                <label className="home-modal__label">
                  Town (optional)
                  <input value={addTown} onChange={(e) => setAddTown(e.target.value)} placeholder="e.g. London" />
                </label>

                {addError ? <div className="home-modal__error">{addError}</div> : null}
              </div>

              <div className="home-modal__actions">
                <button className="btn-secondary" onClick={() => setAddOpen(false)} disabled={addSaving}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={submitAddProperty} disabled={addSaving}>
                  {addSaving ? 'Creating…' : 'Create & select'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className={`home-section home-section--full`}>
          <div className="home-section__header">
            <h2>Feed</h2>
            <p>Newest → oldest, grouped by day.</p>
          </div>

          {feedLoading ? (
            <div className="home-feed__status">Loading…</div>
          ) : feedError ? (
            <div className="home-feed__status home-feed__status--error">{feedError}</div>
          ) : feed.length === 0 ? (
            <div className="home-feed__status">No activity yet.</div>
          ) : (
            <div className="home-feed">
              {feedByDay.map(([day, events]) => (
                <div key={day} className="home-feed__day">
                  <div className="home-feed__day-title">{day}</div>
                  <div className="home-feed__list">
                    {events.map((e) => {
                      const isHighlighted = !!highlightEventId && e.id === highlightEventId;
                      const summary = summarizePayload(e.type, e.payload);
                      const photoUrl =
                        e.type === 'photo' && e.payload && typeof (e.payload as any).imageUrl === 'string'
                          ? String((e.payload as any).imageUrl)
                          : null;
                      const photoCaption =
                        e.type === 'photo' && e.payload && typeof (e.payload as any).caption === 'string'
                          ? String((e.payload as any).caption)
                          : '';

                      const engineerPayload = e.type === 'engineer_output' && e.payload && typeof e.payload === 'object' ? (e.payload as any) : null;
                      const engineerSummary =
                        engineerPayload && typeof engineerPayload.summary === 'string' ? String(engineerPayload.summary) : '';
                      const engineerFacts = engineerPayload ? toEngineerFacts(engineerPayload.facts) : [];
                      const engineerQuestions = engineerPayload ? toStringArray(engineerPayload.questions) : [];
                      const engineerConcerns = engineerPayload ? toStringArray(engineerPayload.concerns) : [];

                      const engineerDiffPayload =
                        e.type === 'engineer_diff' && e.payload && typeof e.payload === 'object' ? (e.payload as any) : null;
                      const engineerDiff: EngineerDiffPayload | null =
                        engineerDiffPayload && typeof engineerDiffPayload.summary === 'string'
                          ? {
                              addedFacts: toStringArray(engineerDiffPayload.addedFacts),
                              removedFacts: toStringArray(engineerDiffPayload.removedFacts),
                              resolvedQuestions: toStringArray(engineerDiffPayload.resolvedQuestions),
                              newConcerns: toStringArray(engineerDiffPayload.newConcerns),
                              summary: String(engineerDiffPayload.summary),
                            }
                          : null;

                      const latestEngineerOutputIdForThisVisit = e.visit?.id
                        ? latestEngineerOutputEventIdByVisit.get(e.visit.id) ?? null
                        : null;

                      return (
                        <div
                          key={e.id}
                          id={`spine-event-${e.id}`}
                          className={`home-feed__item ${isHighlighted ? 'home-feed__item--highlight' : ''}`}
                        >
                          <div className="home-feed__item-title">
                            <span className="home-feed__type">
                              <span className="home-feed__icon" aria-hidden="true">
                                {eventTypeIcon(e.type)}
                              </span>
                              {e.type}
                            </span>
                            <span className="home-feed__time">
                              {new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="home-feed__item-sub">
                            {e.property.addressLine1 ? `${e.property.addressLine1} • ` : ''}
                            {e.property.postcode}
                          </div>
                          {e.type === 'engineer_output' ? (
                            <div className="home-engineer">
                              {e.visit?.id === activeVisitId && e.id === latestEngineerEventIdForActiveVisit ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                                  <button
                                    className="btn-secondary"
                                    onClick={() => navigate(`/customer-summary?visitId=${encodeURIComponent(e.visit.id)}`)}
                                  >
                                    Customer summary
                                  </button>
                                </div>
                              ) : null}
                              <div className="home-engineer__section">
                                <div className="home-engineer__label">Summary</div>
                                <div className="home-engineer__text">{engineerSummary || '—'}</div>
                              </div>
                              {renderEngineerFactsSection(engineerFacts)}
                              {renderEngineerSection('Open questions', engineerQuestions)}
                              {renderEngineerSection('Concerns', engineerConcerns)}
                            </div>
                          ) : e.type === 'engineer_diff' ? (
                            <div className="home-engineer">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <div className="home-engineer__label" style={{ marginTop: 8 }}>
                                  Engineer update
                                </div>
                                <button
                                  className="btn-secondary"
                                  onClick={() => {
                                    if (!latestEngineerOutputIdForThisVisit) return;
                                    setHighlightEventId(latestEngineerOutputIdForThisVisit);
                                  }}
                                  disabled={!latestEngineerOutputIdForThisVisit}
                                >
                                  View full Engineer output
                                </button>
                              </div>

                              <div className="home-engineer__section">
                                <div className="home-engineer__label">Summary</div>
                                <div className="home-engineer__text">{engineerDiff?.summary || '—'}</div>
                              </div>

                              {engineerDiff ? (
                                <>
                                  {engineerDiff.addedFacts.length > 0
                                    ? renderEngineerSection('New facts', engineerDiff.addedFacts)
                                    : null}
                                  {engineerDiff.removedFacts.length > 0
                                    ? renderEngineerSection('Removed facts', engineerDiff.removedFacts)
                                    : null}
                                  {engineerDiff.resolvedQuestions.length > 0
                                    ? renderEngineerSection('Resolved questions', engineerDiff.resolvedQuestions)
                                    : null}
                                  {engineerDiff.newConcerns.length > 0
                                    ? renderEngineerSection('New concerns', engineerDiff.newConcerns)
                                    : null}
                                  {engineerDiff.addedFacts.length === 0 &&
                                  engineerDiff.removedFacts.length === 0 &&
                                  engineerDiff.resolvedQuestions.length === 0 &&
                                  engineerDiff.newConcerns.length === 0 ? (
                                    <div className="home-engineer__empty">No changes.</div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="home-engineer__empty">No diff payload.</div>
                              )}
                            </div>
                          ) : photoUrl ? (
                            <div className="home-feed__photo">
                              <img className="home-feed__photo-img" src={photoUrl} alt="Photo" loading="lazy" />
                              {photoCaption ? <div className="home-feed__photo-caption">{photoCaption}</div> : null}
                            </div>
                          ) : summary ? (
                            <div className="home-feed__payload">{summary}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

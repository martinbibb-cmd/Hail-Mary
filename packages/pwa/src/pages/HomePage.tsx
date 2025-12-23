import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    case 'knowledge_ref':
      return '📚';
    default:
      return '🕒';
  }
};

const truncate = (s: string, max = 140) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

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
  const setActiveProperty = useSpineStore((s) => s.setActiveProperty);

  const isDesktop = layout === 'desktop';

  // v2 spine: All Activity feed
  const [feed, setFeed] = useState<SpineFeedEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);

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

  const feedByDay = useMemo(() => {
    const groups: Record<string, SpineFeedEvent[]> = {};
    for (const e of feed) {
      const day = new Date(e.ts).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      groups[day] = groups[day] ? [...groups[day], e] : [e];
    }
    return Object.entries(groups);
  }, [feed]);

  // v2 spine: Postcode-first property search (accelerator)
  const [postcodeQuery, setPostcodeQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<SpineProperty[]>([]);
  const [propertyLoading, setPropertyLoading] = useState(false);

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
            <h2>Postcode search</h2>
            <p>Search does not redirect. Active property is optional.</p>
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
                        setActiveProperty({
                          id: p.id,
                          addressLine1: p.addressLine1,
                          addressLine2: p.addressLine2,
                          town: p.town,
                          postcode: p.postcode,
                        })
                      }
                    >
                      Set active
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

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
                      const summary = summarizePayload(e.type, e.payload);
                      return (
                        <div key={e.id} className="home-feed__item">
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
                          {summary ? <div className="home-feed__payload">{summary}</div> : null}
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

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { LayoutMode } from '../hooks/useLayoutMode';
import { useWindowStore } from '../os/window-manager';
import { AdminApiStatus } from '../components/AdminApiStatus';
import { MEDIA_RECEIVER_ONLY } from '../config/featureFlags';
import { useSpineStore } from '../stores/spineStore';
import './HomePage.css';

type ShortcutAction =
  | { kind: 'route'; target: string }
  | { kind: 'window'; target: string };

interface Shortcut {
  id: string;
  name: string;
  description: string;
  icon: string;
  action: ShortcutAction;
  badge?: string;
}

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

export const HomePage: React.FC<HomePageProps> = ({ layout }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const windows = useWindowStore((state) => state.windows);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
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

  const openAppWindow = (appId: string, title: string) => {
    const existing = windows.find((w) => w.appId === appId);
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow(appId, title);
    }
  };

  const coreShortcuts: Shortcut[] = [
    { id: 'leads', name: 'Leads', description: 'Pipelines & surveys', icon: '🧲', action: { kind: 'route', target: '/leads' } },
    { id: 'customers', name: 'Customers', description: 'Accounts & details', icon: '👥', action: { kind: 'route', target: '/customers' } },
    { id: 'quotes', name: 'Quotes', description: 'Estimates & proposals', icon: '💷', action: { kind: 'route', target: '/quotes' } },
    { id: 'files', name: 'Files', description: 'Project docs', icon: '📂', action: { kind: 'route', target: '/files' } },
    { id: 'profile', name: 'Profile', description: 'Account & preferences', icon: '👤', action: { kind: 'route', target: '/profile' } },
  ];

  const surveyShortcuts: Shortcut[] = [
    { id: 'property', name: 'Property', description: 'Address & property facts', icon: '🏠', action: { kind: 'window', target: 'property' } },
    { id: 'central-heating', name: 'Boiler / CH', description: 'Existing system checks', icon: '🔥', action: { kind: 'window', target: 'central_heating' } },
    { id: 'hazards', name: 'Hazards', description: 'Safety blockers & risks', icon: '⚠️', action: { kind: 'window', target: 'hazards' } },
    { id: 'heat-pump', name: 'Heat Pump', description: 'Suitability stub', icon: '♨️', action: { kind: 'window', target: 'heat_pump' }, badge: 'Preview' },
    { id: 'pv', name: 'Solar PV', description: 'Solar opportunity', icon: '☀️', action: { kind: 'window', target: 'pv' }, badge: 'Preview' },
    { id: 'ev', name: 'EV Charging', description: 'EV supply checks', icon: '🔌', action: { kind: 'window', target: 'ev' }, badge: 'Preview' },
    { id: 'roadmap', name: 'Roadmap', description: 'Upgrades & next steps', icon: '🗺️', action: { kind: 'window', target: 'roadmap' }, badge: 'Beta' },
    { id: 'other-trades', name: 'Other trades', description: 'Future trade gateway', icon: '🛠️', action: { kind: 'window', target: 'other_trades' }, badge: 'Beta' },
  ];

  const toolShortcuts: Shortcut[] = [
    { id: 'rocky', name: 'Rocky', description: 'Fact extraction', icon: '🪨', action: { kind: 'window', target: 'rocky' } },
    { id: 'sarah', name: 'Sarah', description: 'Explain findings', icon: '🧠', action: { kind: 'window', target: 'sarah' } },
    { id: 'diary', name: 'Diary', description: 'Jobs & appointments', icon: '🗓', action: { kind: 'window', target: 'diary' } },
    ...(MEDIA_RECEIVER_ONLY
      ? []
      : [{ id: 'photos', name: 'Photos', description: 'Capture site photos', icon: '📸', action: { kind: 'window', target: 'photos' } as const }]),
  ];

  const adminShortcuts: Shortcut[] = user?.role === 'admin'
    ? [
        { id: 'admin-nas', name: 'NAS', description: 'System health & migrations', icon: '🖥️', action: { kind: 'route', target: '/admin/nas' } },
        { id: 'admin-users', name: 'Users', description: 'Reset links & roles', icon: '🛂', action: { kind: 'route', target: '/admin/users' } },
        { id: 'admin-knowledge', name: 'Knowledge', description: 'Docs & uploads', icon: '📚', action: { kind: 'route', target: '/admin/knowledge' } },
        { id: 'admin-system-recommendation', name: 'System Rec', description: 'Submodule management', icon: '🔥', action: { kind: 'route', target: '/admin/system-recommendation' } },
      ]
    : [];

  const handleShortcutClick = (shortcut: Shortcut) => {
    if (shortcut.action.kind === 'route') {
      navigate(shortcut.action.target);
    } else {
      openAppWindow(shortcut.action.target, shortcut.name);
    }
  };

  const renderShortcut = (shortcut: Shortcut) => (
    <button
      key={shortcut.id}
      className={`home-shortcut ${isDesktop ? 'home-shortcut--icon' : 'home-shortcut--tile'}`}
      onClick={() => handleShortcutClick(shortcut)}
    >
      <div className="home-shortcut__icon">
        <span>{shortcut.icon}</span>
        {shortcut.badge && <span className="home-shortcut__badge">{shortcut.badge}</span>}
      </div>
      <div className="home-shortcut__text">
        <p className="home-shortcut__title">{shortcut.name}</p>
        <p className="home-shortcut__desc">{shortcut.description}</p>
      </div>
    </button>
  );

  return (
    <div className="home-page">
      <div className="home-hero">
        <div className="home-hero__text">
          <p className="home-hero__eyebrow">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
          <h1 className="home-hero__title">All Activity</h1>
        </div>
      </div>

      <div className={`home-grid ${isDesktop ? 'home-grid--desktop' : 'home-grid--stacked'}`}>
        <section className={`home-section home-section--full`}>
          <div className="home-section__header">
            <h2>Feed</h2>
            <p>Latest timeline events across all properties.</p>
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
                    {events.map((e) => (
                      <div key={e.id} className="home-feed__item">
                        <div className="home-feed__item-main">
                          <div className="home-feed__item-title">
                            <span className="home-feed__type">{e.type}</span>
                            <span className="home-feed__time">
                              {new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="home-feed__item-sub">
                            {e.property.addressLine1} • {e.property.postcode}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="home-section">
          <div className="home-section__header">
            <h2>Postcode search</h2>
            <p>Set an active property when you want focus (optional).</p>
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

        <section className="home-section">
          <div className="home-section__header">
            <h2>Core workspace</h2>
          </div>
          <div className={`home-section__shortcuts ${isDesktop ? 'home-section__shortcuts--desktop' : 'home-section__shortcuts--tiles'}`}>
            {coreShortcuts.map(renderShortcut)}
          </div>
        </section>

        <section className="home-section">
          <div className="home-section__header">
            <h2>Survey modules</h2>
          </div>
          <div className={`home-section__shortcuts ${isDesktop ? 'home-section__shortcuts--desktop' : 'home-section__shortcuts--tiles'}`}>
            {surveyShortcuts.map(renderShortcut)}
          </div>
        </section>

        <section className="home-section">
          <div className="home-section__header">
            <h2>Tools</h2>
          </div>
          <div className={`home-section__shortcuts ${isDesktop ? 'home-section__shortcuts--desktop' : 'home-section__shortcuts--tiles'}`}>
            {toolShortcuts.map(renderShortcut)}
          </div>
        </section>

        {adminShortcuts.length > 0 && (
          <section className="home-section">
            <div className="home-section__header">
              <h2>Admin</h2>
            </div>
            <div className={`home-section__shortcuts ${isDesktop ? 'home-section__shortcuts--desktop' : 'home-section__shortcuts--tiles'}`}>
              {adminShortcuts.map(renderShortcut)}
            </div>
            <AdminApiStatus />
          </section>
        )}
      </div>
    </div>
  );
};

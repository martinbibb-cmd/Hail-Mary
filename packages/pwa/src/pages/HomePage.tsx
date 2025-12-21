import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { LayoutMode } from '../hooks/useLayoutMode';
import { useWindowStore } from '../os/window-manager';
import { AdminApiStatus } from '../components/AdminApiStatus';
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

export const HomePage: React.FC<HomePageProps> = ({ layout }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const windows = useWindowStore((state) => state.windows);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const openWindow = useWindowStore((state) => state.openWindow);

  const isDesktop = layout === 'desktop';

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
    { id: 'settings', name: 'Settings', description: 'Wallpaper, focus, admin', icon: '⚙️', action: { kind: 'window', target: 'settings' } },
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
    { id: 'photos', name: 'Photos', description: 'Capture site photos', icon: '📸', action: { kind: 'window', target: 'photos' } },
  ];

  const adminShortcuts: Shortcut[] = user?.role === 'admin'
    ? [
        { id: 'admin-nas', name: 'NAS', description: 'System health & migrations', icon: '🖥️', action: { kind: 'route', target: '/admin/nas' } },
        { id: 'admin-users', name: 'Users', description: 'Reset links & roles', icon: '🛂', action: { kind: 'route', target: '/admin/users' } },
        { id: 'admin-knowledge', name: 'Knowledge', description: 'Docs & uploads', icon: '📚', action: { kind: 'route', target: '/admin/knowledge' } },
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
          <h1 className="home-hero__title">Workspace</h1>
        </div>
      </div>

      <div className={`home-grid ${isDesktop ? 'home-grid--desktop' : 'home-grid--stacked'}`}>
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

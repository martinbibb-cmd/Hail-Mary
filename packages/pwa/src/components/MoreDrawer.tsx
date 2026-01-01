/**
 * More Drawer (Side Rail)
 * 
 * Drawer for admin/navigation links.
 * Opens from "More" button in bottom dock.
 * Contains: Leads, Quotes, Files, Profile, Settings (and admin tools for admins)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useWindowStore } from '../os/window-manager';
import './MoreDrawer.css';

interface MoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoreDrawer: React.FC<MoreDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const windows = useWindowStore((state) => state.windows);
  const openWindow = useWindowStore((state) => state.openWindow);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);

  type MenuAction =
    | { kind: 'route'; target: string }
    | { kind: 'window'; target: string };

  const openAppWindow = (appId: string, title: string) => {
    const existing = windows.find((w) => w.appId === appId);
    if (existing) {
      if (existing.state === 'minimized') {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
      return;
    }
    openWindow(appId, title);
  };

  const handleAction = (action: MenuAction, label: string) => {
    if (action.kind === 'route') {
      navigate(action.target);
    } else {
      openAppWindow(action.target, label);
    }
    onClose();
  };

  const menuItems: Array<{
    id: string;
    label: string;
    icon: string;
    description: string;
    action: MenuAction;
  }> = [
    {
      id: 'visit',
      label: 'Visit Notes',
      icon: '🎙️',
      description: 'Voice-driven surveys',
      action: { kind: 'route', target: '/visit' },
    },
    {
      id: 'engineer',
      label: 'Engineer',
      icon: '🔧',
      description: 'Transcription analysis',
      action: { kind: 'route', target: '/engineer' },
    },
    {
      id: 'presentation',
      label: 'Presentation',
      icon: '📊',
      description: 'Customer presentations',
      action: { kind: 'route', target: '/presentation' },
    },
    {
      id: 'gc-lookup',
      label: 'GC Lookup',
      icon: '🔍',
      description: 'Boiler GC number lookup',
      action: { kind: 'route', target: '/gc-lookup' },
    },
    {
      id: 'leads',
      label: 'Leads',
      icon: '🧲',
      description: 'Pipeline & surveys',
      action: { kind: 'route', target: '/leads' },
    },
    {
      id: 'quotes',
      label: 'Quotes',
      icon: '💷',
      description: 'Estimates & proposals',
      action: { kind: 'route', target: '/quotes' },
    },
    {
      id: 'files',
      label: 'Files',
      icon: '📂',
      description: 'Project documents',
      action: { kind: 'route', target: '/files' },
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      description: 'Account & preferences',
      action: { kind: 'route', target: '/profile' },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'App configuration',
      action: { kind: 'window', target: 'settings' },
    },
  ];

  const adminMenuItems = user?.role === 'admin'
    ? [
        {
          id: 'admin-users',
          label: 'Users',
          icon: '🛂',
          description: 'Reset links & roles',
          action: { kind: 'route', target: '/admin/users' } as const,
        },
        {
          id: 'admin-nas',
          label: 'NAS',
          icon: '🖥️',
          description: 'System health & migrations',
          action: { kind: 'route', target: '/admin/nas' } as const,
        },
        {
          id: 'admin-knowledge',
          label: 'Knowledge',
          icon: '📚',
          description: 'Docs & uploads',
          action: { kind: 'route', target: '/admin/knowledge' } as const,
        },
        {
          id: 'admin-system-recommendation',
          label: 'System Rec',
          icon: '🔥',
          description: 'Submodule management',
          action: { kind: 'route', target: '/admin/system-recommendation' } as const,
        },
      ]
    : [];

  if (!isOpen) return null;

  return (
    <>
      <div className="more-drawer-overlay" onClick={onClose} />
      <div className="more-drawer">
        <div className="more-drawer-header">
          <h2>More</h2>
          <button className="more-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="more-drawer-body">
          <nav className="more-drawer-menu">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="more-menu-item"
                onClick={() => handleAction(item.action, item.label)}
              >
                <span className="more-menu-icon">{item.icon}</span>
                <div className="more-menu-text">
                  <div className="more-menu-label">{item.label}</div>
                  <div className="more-menu-description">{item.description}</div>
                </div>
                <span className="more-menu-arrow">→</span>
              </button>
            ))}

            {adminMenuItems.length > 0 && (
              <div className="more-menu-divider" aria-hidden="true" />
            )}

            {adminMenuItems.map((item) => (
              <button
                key={item.id}
                className="more-menu-item"
                onClick={() => handleAction(item.action, item.label)}
              >
                <span className="more-menu-icon">{item.icon}</span>
                <div className="more-menu-text">
                  <div className="more-menu-label">{item.label}</div>
                  <div className="more-menu-description">{item.description}</div>
                </div>
                <span className="more-menu-arrow">→</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

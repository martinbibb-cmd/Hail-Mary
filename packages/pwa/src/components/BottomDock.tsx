/**
 * Bottom Dock
 *
 * v2 Spine dock with customizable items.
 * Items can be configured via Settings app.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomDock.css';

// All available dock items
const ALL_DOCK_ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/' },
  { id: 'addresses', label: 'Addresses', icon: '🏘️', path: '/addresses' },
  { id: 'diary', label: 'Diary', icon: '📅', path: '/diary' },
  { id: 'camera', label: 'Camera', icon: '📷', path: '/camera' },
  { id: 'photo-library', label: 'Photos', icon: '🖼️', path: '/photo-library' },
  { id: 'transcripts', label: 'Transcripts', icon: '📝', path: '/transcripts' },
  { id: 'scans', label: 'Scans', icon: '📊', path: '/scans' },
  { id: 'engineer', label: 'Engineer', icon: '🛠️', path: '/engineer' },
  { id: 'sarah', label: 'Sarah', icon: '🧠', path: '/sarah' },
  { id: 'presentation', label: 'Pack', icon: '📄', path: '/presentation' },
  { id: 'knowledge', label: 'Knowledge', icon: '📚', path: '/knowledge' },
  { id: 'trajectory', label: 'Journey', icon: '🌱', path: '/trajectory' },
  { id: 'profile', label: 'Settings', icon: '⚙️', path: '/profile' },
];

// Default visible dock items
const DEFAULT_DOCK_ITEMS = [
  'home', 'addresses', 'diary', 'camera', 'photo-library',
  'transcripts', 'scans', 'engineer', 'sarah', 'presentation',
  'knowledge', 'profile'
];

/**
 * Safely load dock items from localStorage with validation
 * Returns DEFAULT_DOCK_ITEMS if stored value is invalid
 */
function loadDockItems(): string[] {
  try {
    const stored = localStorage.getItem('dockItems');
    if (!stored) {
      return DEFAULT_DOCK_ITEMS;
    }

    const parsed = JSON.parse(stored);
    
    // Validate that it's an array of strings
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed;
    }

    // Invalid format - clear and return default
    console.warn('[BottomDock] Invalid dockItems format in localStorage, resetting to default');
    localStorage.removeItem('dockItems');
    return DEFAULT_DOCK_ITEMS;
  } catch (error) {
    // JSON parse error or localStorage access error - clear and return default
    console.warn('[BottomDock] Failed to parse dockItems from localStorage, resetting to default', error);
    try {
      localStorage.removeItem('dockItems');
    } catch {
      // If we can't even clear localStorage, just continue with defaults
    }
    return DEFAULT_DOCK_ITEMS;
  }
}

export const BottomDock: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Load selected items from localStorage
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => loadDockItems());

  // Listen for dock customization changes
  useEffect(() => {
    const handleDockItemsChanged = () => {
      try {
        setSelectedItemIds(loadDockItems());
      } catch (error) {
        console.error('[BottomDock] Error handling dockItemsChanged event', error);
        setSelectedItemIds(DEFAULT_DOCK_ITEMS);
      }
    };

    window.addEventListener('dockItemsChanged', handleDockItemsChanged);
    return () => window.removeEventListener('dockItemsChanged', handleDockItemsChanged);
  }, []);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    if (path === '/profile') {
      return location.pathname === '/profile' || location.pathname.startsWith('/admin');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Filter and map dock items
  const dockItems = ALL_DOCK_ITEMS
    .filter(item => selectedItemIds.includes(item.id))
    .map(item => ({
      ...item,
      onClick: () => navigate(item.path),
      isActive: isActive(item.path),
    }));

  return (
    <nav className="bottom-dock">
      <div className="bottom-dock-container">
        {dockItems.map((item) => (
          <button
            key={item.id}
            className={`bottom-dock-item ${item.isActive ? 'bottom-dock-item-active' : ''}`}
            onClick={item.onClick}
            aria-label={item.label}
          >
            <span className="bottom-dock-icon">{item.icon}</span>
            <span className="bottom-dock-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

/**
 * Bottom Dock
 * 
 * v2 Spine dock (placeholders for now).
 * Contains 6 items: Home, Camera, Voice, Engineer, Sarah, Knowledge.
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomDock.css';

export const BottomDock: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const dockItems = [
    {
      id: 'home',
      label: 'Home',
      icon: '🏠',
      onClick: () => navigate('/'),
      isActive: location.pathname === '/',
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: '📷',
      onClick: () => navigate('/camera'),
      isActive: isActive('/camera'),
    },
    {
      id: 'voice',
      label: 'Voice',
      icon: '🎙️',
      onClick: () => navigate('/voice'),
      isActive: isActive('/voice'),
    },
    {
      id: 'engineer',
      label: 'Engineer',
      icon: '🛠️',
      onClick: () => navigate('/engineer'),
      isActive: isActive('/engineer'),
    },
    {
      id: 'sarah',
      label: 'Sarah',
      icon: '🧠',
      onClick: () => navigate('/sarah'),
      isActive: isActive('/sarah'),
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: '📚',
      onClick: () => navigate('/knowledge'),
      isActive: isActive('/knowledge'),
    },
  ];

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

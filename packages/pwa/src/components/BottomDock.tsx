/**
 * Bottom Dock
 * 
 * Always-visible bottom dock across the entire app (all breakpoints).
 * Contains 5 items: Home, Sarah, Diary (Rocky), Photos, More
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomDock.css';

interface BottomDockProps {
  onOpenMoreDrawer: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({ onOpenMoreDrawer }) => {
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
      id: 'sarah',
      label: 'Sarah',
      icon: '🧠',
      onClick: () => navigate('/sarah'),
      isActive: isActive('/sarah'),
    },
    {
      id: 'diary',
      label: 'Diary',
      icon: '🗓',
      onClick: () => navigate('/rocky'),
      isActive: isActive('/rocky'),
    },
    {
      id: 'photos',
      label: 'Photos',
      icon: '📸',
      onClick: () => navigate('/photos'),
      isActive: isActive('/photos'),
    },
    {
      id: 'more',
      label: 'More',
      icon: '☰',
      onClick: onOpenMoreDrawer,
      isActive: false,
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

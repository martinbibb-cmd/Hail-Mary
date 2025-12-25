/**
 * Bottom Dock
 * 
 * v2 Spine dock (placeholders for now).
 * Contains 8 items: Home, Camera, Voice, Engineer, Sarah, Pack, Knowledge, Settings.
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
      isActive: location.pathname === '/' || location.pathname === '/home',
    },
    {
      id: 'addresses',
      label: 'Addresses',
      icon: '🏘️',
      onClick: () => navigate('/addresses'),
      isActive: isActive('/addresses'),
    },
    {
      id: 'diary',
      label: 'Diary',
      icon: '📅',
      onClick: () => navigate('/diary'),
      isActive: isActive('/diary'),
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: '📷',
      onClick: () => navigate('/camera'),
      isActive: isActive('/camera'),
    },
    {
      id: 'photo-library',
      label: 'Photos',
      icon: '🖼️',
      onClick: () => navigate('/photo-library'),
      isActive: isActive('/photo-library'),
    },
    {
      id: 'transcripts',
      label: 'Transcripts',
      icon: '📝',
      onClick: () => navigate('/transcripts'),
      isActive: isActive('/transcripts'),
    },
    {
      id: 'scans',
      label: 'Scans',
      icon: '📊',
      onClick: () => navigate('/scans'),
      isActive: isActive('/scans'),
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
      id: 'presentation',
      label: 'Pack',
      icon: '📄',
      onClick: () => navigate('/presentation'),
      isActive: isActive('/presentation'),
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      icon: '📚',
      onClick: () => navigate('/knowledge'),
      isActive: isActive('/knowledge'),
    },
    {
      id: 'profile',
      label: 'Settings',
      icon: '⚙️',
      onClick: () => navigate('/profile'),
      isActive: isActive('/profile') || isActive('/admin'),
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

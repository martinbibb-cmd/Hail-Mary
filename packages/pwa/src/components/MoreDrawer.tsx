/**
 * More Drawer (Side Rail)
 * 
 * Drawer for admin/navigation links.
 * Opens from "More" button in bottom dock.
 * Contains: Leads, Quotes, Files, Profile, Settings
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MoreDrawer.css';

interface MoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoreDrawer: React.FC<MoreDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const menuItems = [
    {
      id: 'leads',
      label: 'Leads',
      icon: '🧲',
      description: 'Pipeline & surveys',
      path: '/leads',
    },
    {
      id: 'quotes',
      label: 'Quotes',
      icon: '💷',
      description: 'Estimates & proposals',
      path: '/quotes',
    },
    {
      id: 'files',
      label: 'Files',
      icon: '📂',
      description: 'Project documents',
      path: '/files',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      description: 'Account & preferences',
      path: '/profile',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'App configuration',
      path: '/admin/users',
    },
  ];

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
                onClick={() => handleNavigate(item.path)}
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

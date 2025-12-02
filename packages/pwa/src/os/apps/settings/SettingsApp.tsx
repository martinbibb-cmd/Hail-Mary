/**
 * Settings App - System settings for Hail-Mary
 * 
 * Features:
 * - User profile section with logout
 * - General preferences
 */

import React from 'react';
import { useAuth } from '../../../auth';
import './SettingsApp.css';

export const SettingsApp: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="settings-app">
      <h2>⚙️ Settings</h2>

      <div className="settings-section">
        <h3>Account</h3>
        {user && (
          <div className="settings-user-info">
            <div className="settings-user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="settings-user-details">
              <p className="settings-user-name">{user.name}</p>
              <p className="settings-user-email">{user.email}</p>
            </div>
          </div>
        )}
        <button className="settings-logout-btn" onClick={handleLogout}>
          🚪 Log Out
        </button>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="settings-about">
          <p><strong>Hail-Mary</strong></p>
          <p className="settings-version">Version 0.1.0</p>
          <p className="settings-description">
            Universal quote tool for boiler/heating businesses
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsApp;

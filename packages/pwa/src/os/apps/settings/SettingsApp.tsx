/**
 * Settings App - System settings for Hail-Mary
 * 
 * Features:
 * - User profile section with logout
 * - Appearance & Wallpaper settings
 * - General preferences
 */

import React, { useRef } from 'react';
import { useAuth } from '../../../auth';
import { useWallpaper, builtInWallpapers, Wallpaper } from '../../wallpaper';
import { cognitiveProfiles, useCognitiveProfile } from '../../../cognitive/CognitiveProfileContext';
import './SettingsApp.css';

export const SettingsApp: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    currentWallpaper, 
    customWallpapers, 
    setWallpaper, 
    addCustomWallpaper,
    removeCustomWallpaper
  } = useWallpaper();
  const { profile, settings, setProfile, updateSettings } = useCognitiveProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await logout();
  };

  const handleWallpaperSelect = (wallpaper: Wallpaper) => {
    setWallpaper(wallpaper);
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      const newWallpaper = addCustomWallpaper(objectUrl, file.name.replace(/\.[^/.]+$/, ''));
      setWallpaper(newWallpaper);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveCustom = (wallpaper: Wallpaper, e: React.MouseEvent) => {
    e.stopPropagation();
    if (wallpaper.imageUrl) {
      URL.revokeObjectURL(wallpaper.imageUrl);
    }
    removeCustomWallpaper(wallpaper.id);
  };

  return (
    <div className="settings-app">
      <h2>⚙️ Settings</h2>

      <div className="settings-section">
        <h3>Account</h3>
        {user && (
          <div className="settings-user-info">
            <div className="settings-user-avatar">
              {user.name?.charAt(0)?.toUpperCase() || '?'}
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
        <h3>Cognitive Profiles</h3>
        <p className="settings-section-desc">
          Adapt Hail-Mary for different neuro types by changing information density, fonts, and safety nets.
        </p>

        <div className="cognitive-profile-grid">
          {cognitiveProfiles.map((option) => (
            <label key={option.id} className={`cognitive-card ${profile === option.id ? 'active' : ''}`}>
              <input
                type="radio"
                name="cognitive-profile"
                value={option.id}
                checked={profile === option.id}
                onChange={() => setProfile(option.id)}
              />
              <div className="cognitive-card-body">
                <div className="cognitive-card-heading">
                  <p className="cognitive-card-title">{option.label}</p>
                  <p className="cognitive-card-intent">{option.intent}</p>
                </div>
                <p className="cognitive-card-copy">{option.highlights}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="cognitive-toggle-grid">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.focusTimers}
              onChange={(e) => updateSettings({ focusTimers: e.target.checked })}
            />
            <div>
              <p className="toggle-title">Visual timers</p>
              <p className="toggle-copy">Adds a Time Timer-style countdown bar in Focus mode.</p>
            </div>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.bionicReading}
              onChange={(e) => updateSettings({ bionicReading: e.target.checked })}
            />
            <div>
              <p className="toggle-title">Bionic reading emphasis</p>
              <p className="toggle-copy">Bold leading letters to help dyslexic readers scan faster.</p>
            </div>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.calmSafeMode}
              onChange={(e) => updateSettings({ calmSafeMode: e.target.checked })}
            />
            <div>
              <p className="toggle-title">Safe-mode confirmations</p>
              <p className="toggle-copy">Softens alerts and adds gentle affordances for anxious workflows.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance & Wallpaper</h3>
        <p className="settings-section-desc">Choose a wallpaper for your desktop</p>
        
        <div className="wallpaper-grid">
          {builtInWallpapers.map(wallpaper => (
            <button
              key={wallpaper.id}
              className={`wallpaper-tile ${currentWallpaper.id === wallpaper.id ? 'active' : ''}`}
              onClick={() => handleWallpaperSelect(wallpaper)}
              style={{ background: wallpaper.preview }}
              title={wallpaper.name}
            >
              <span className="wallpaper-name">{wallpaper.name}</span>
              {currentWallpaper.id === wallpaper.id && (
                <span className="wallpaper-check">✓</span>
              )}
            </button>
          ))}
          
          {/* Custom wallpapers */}
          {customWallpapers.map(wallpaper => (
            <button
              key={wallpaper.id}
              className={`wallpaper-tile custom ${currentWallpaper.id === wallpaper.id ? 'active' : ''}`}
              onClick={() => handleWallpaperSelect(wallpaper)}
              style={{ 
                backgroundImage: wallpaper.imageUrl ? `url(${wallpaper.imageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              title={wallpaper.name}
            >
              <span className="wallpaper-name">{wallpaper.name}</span>
              {currentWallpaper.id === wallpaper.id && (
                <span className="wallpaper-check">✓</span>
              )}
              <button 
                className="wallpaper-remove"
                onClick={(e) => handleRemoveCustom(wallpaper, e)}
                title="Remove wallpaper"
              >
                ✕
              </button>
            </button>
          ))}
          
          {/* Upload custom wallpaper button */}
          <button 
            className="wallpaper-tile upload-tile"
            onClick={() => fileInputRef.current?.click()}
            title="Upload custom wallpaper"
          >
            <span className="upload-icon">+</span>
            <span className="wallpaper-name">Custom</span>
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="settings-about">
          <p><strong>Hail-Mary</strong></p>
          <p className="settings-version">Version {__APP_VERSION__}</p>
          <p className="settings-build-time">Built: {new Date(__BUILD_TIME__).toLocaleString()}</p>
          <p className="settings-description">
            Universal quote tool for boiler/heating businesses
          </p>
        </div>
      </div>
    </div>
  );
};


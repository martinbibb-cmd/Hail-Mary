/**
 * Settings App - System settings for Hail-Mary
 * 
 * Features:
 * - User profile section with logout
 * - Appearance & Wallpaper settings
 * - General preferences
 */

import React, { useRef, useState } from 'react';
import { useAuth } from '../../../auth';
import { useWallpaper, builtInWallpapers, Wallpaper } from '../../wallpaper';
import { cognitiveProfiles, useCognitiveProfile } from '../../../cognitive/CognitiveProfileContext';
import { AdminSystem } from './AdminSystem';
import { AdminAddressAssignment } from './AdminAddressAssignment';
import './SettingsApp.css';

// All available dock items
const ALL_DOCK_ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'addresses', label: 'Addresses', icon: '🏘️' },
  { id: 'diary', label: 'Diary', icon: '📅' },
  { id: 'camera', label: 'Camera', icon: '📷' },
  { id: 'photo-library', label: 'Photos', icon: '🖼️' },
  { id: 'transcripts', label: 'Transcripts', icon: '📝' },
  { id: 'scans', label: 'Scans', icon: '📊' },
  { id: 'engineer', label: 'Engineer', icon: '🛠️' },
  { id: 'sarah', label: 'Sarah', icon: '🧠' },
  { id: 'presentation', label: 'Pack', icon: '📄' },
  { id: 'knowledge', label: 'Knowledge', icon: '📚' },
  { id: 'trajectory', label: 'Journey', icon: '🌱' },
  { id: 'profile', label: 'Settings', icon: '⚙️' },
];

// Default visible dock items (matches current hardcoded dock)
const DEFAULT_DOCK_ITEMS = [
  'home', 'addresses', 'diary', 'camera', 'photo-library',
  'transcripts', 'scans', 'engineer', 'sarah', 'presentation',
  'knowledge', 'profile'
];

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
  const [updateState, setUpdateState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // Dock customization state
  const [selectedDockItems, setSelectedDockItems] = useState<string[]>(() => {
    const stored = localStorage.getItem('dockItems');
    return stored ? JSON.parse(stored) : DEFAULT_DOCK_ITEMS;
  });

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

  const handleDockItemToggle = (itemId: string) => {
    const newSelection = selectedDockItems.includes(itemId)
      ? selectedDockItems.filter(id => id !== itemId)
      : [...selectedDockItems, itemId];

    setSelectedDockItems(newSelection);
    localStorage.setItem('dockItems', JSON.stringify(newSelection));

    // Dispatch custom event to notify BottomDock of changes
    window.dispatchEvent(new CustomEvent('dockItemsChanged'));
  };

  const handleResetDock = () => {
    setSelectedDockItems(DEFAULT_DOCK_ITEMS);
    localStorage.setItem('dockItems', JSON.stringify(DEFAULT_DOCK_ITEMS));
    window.dispatchEvent(new CustomEvent('dockItemsChanged'));
  };

  const handleUpdate = async () => {
    setUpdateState('working');
    setUpdateMessage('Clearing cached data and checking for the latest build...');

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      localStorage.clear();
      sessionStorage.clear();

      setUpdateState('done');
      setUpdateMessage('Update applied. Reloading...');
      window.location.reload();
    } catch (err) {
      setUpdateState('error');
      setUpdateMessage(err instanceof Error ? err.message : 'Failed to refresh the app');
    }
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
        <h3>Speech-to-Text Provider</h3>
        <p className="settings-section-desc">Choose how voice transcription is processed</p>
        
        <div className="cognitive-toggle-grid">
          <label className="toggle-row">
            <input
              type="radio"
              name="stt-provider"
              value="browser"
              checked={settings.sttProvider === 'browser'}
              onChange={() => updateSettings({ sttProvider: 'browser' })}
            />
            <div>
              <p className="toggle-title">Browser (Real-time)</p>
              <p className="toggle-copy">Uses your browser's built-in speech recognition for instant transcription.</p>
            </div>
          </label>

          <label className="toggle-row">
            <input
              type="radio"
              name="stt-provider"
              value="whisper"
              checked={settings.sttProvider === 'whisper'}
              onChange={() => updateSettings({ sttProvider: 'whisper' })}
            />
            <div>
              <p className="toggle-title">Whisper (High Accuracy)</p>
              <p className="toggle-copy">Records audio and uses OpenAI Whisper for more accurate transcription after recording stops.</p>
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
        <h3>Bottom Dock</h3>
        <p className="settings-section-desc">
          Customize which apps appear in your bottom navigation bar. Select the items you want visible.
        </p>

        <div className="dock-items-grid">
          {ALL_DOCK_ITEMS.map((item) => {
            const isSelected = selectedDockItems.includes(item.id);
            const isProfileOrSettings = item.id === 'profile';

            return (
              <label
                key={item.id}
                className={`dock-item-card ${isSelected ? 'selected' : ''} ${isProfileOrSettings ? 'locked' : ''}`}
                title={isProfileOrSettings ? 'Settings is always visible' : `Toggle ${item.label}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => !isProfileOrSettings && handleDockItemToggle(item.id)}
                  disabled={isProfileOrSettings}
                />
                <span className="dock-item-icon">{item.icon}</span>
                <span className="dock-item-label">{item.label}</span>
                {isProfileOrSettings && <span className="dock-item-lock">🔒</span>}
              </label>
            );
          })}
        </div>

        <div className="dock-actions">
          <button className="settings-reset-btn" onClick={handleResetDock}>
            ↺ Reset to Default
          </button>
          <p className="dock-items-count">
            {selectedDockItems.length} {selectedDockItems.length === 1 ? 'item' : 'items'} selected
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Updates</h3>
        <p className="settings-section-desc">Clear cached assets and reload the newest admin/API build.</p>
        <div className="settings-update-card">
          <div>
            <p className="settings-update-copy">
              Removes offline cache, unregisters service workers, and reloads the PWA so you get the freshest version.
            </p>
            {updateMessage && (
              <p className={`settings-update-message ${updateState === 'error' ? 'error' : 'success'}`}>
                {updateMessage}
              </p>
            )}
          </div>
          <button
            className="settings-update-btn"
            onClick={handleUpdate}
            disabled={updateState === 'working'}
          >
            {updateState === 'working' ? 'Updating…' : '🔄 Update & Reload'}
          </button>
        </div>
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

      {/* Admin-only section */}
      {user?.role === 'admin' && (
        <>
          <div className="settings-section">
            <AdminSystem />
          </div>
          <div className="settings-section">
            <AdminAddressAssignment />
          </div>
        </>
      )}
    </div>
  );
};

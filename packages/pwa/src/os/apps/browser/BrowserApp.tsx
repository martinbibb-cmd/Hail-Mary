/**
 * Browser App - Internal browser for Hail-Mary
 * 
 * Features:
 * - URL bar with Go button
 * - Reload button
 * - Open in Safari button (for when iframes are blocked)
 * - Preset quick links
 * - iframe for content display
 */

import React, { useState, useCallback } from 'react';
import './BrowserApp.css';

function normaliseUrl(raw: string): string {
  if (!raw) return '';
  let url = raw.trim();

  // If missing scheme, assume https
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

const presetLinks = [
  { label: 'GitHub', url: 'https://github.com/martinbibb-cmd' },
  { label: 'GitHub Pages', url: 'https://martinbibb-cmd.github.io' },
  { label: 'Atlas', url: '/' },
];

export const BrowserApp: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('about:blank');

  const loadUrl = useCallback((rawUrl: string) => {
    const url = normaliseUrl(rawUrl);
    if (!url) return;
    setInputUrl(url);
    setCurrentUrl(url);
  }, []);

  const handleGo = useCallback(() => {
    loadUrl(inputUrl);
  }, [inputUrl, loadUrl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGo();
    }
  }, [handleGo]);

  const handleReload = useCallback(() => {
    if (currentUrl && currentUrl !== 'about:blank') {
      // Force reload by setting to blank then back
      const urlToReload = currentUrl;
      setCurrentUrl('about:blank');
      setTimeout(() => setCurrentUrl(urlToReload), 50);
    }
  }, [currentUrl]);

  const handleOpenExternal = useCallback(() => {
    if (currentUrl && currentUrl !== 'about:blank') {
      window.open(currentUrl, '_blank', 'noopener,noreferrer');
    }
  }, [currentUrl]);

  const handlePresetClick = useCallback((url: string) => {
    loadUrl(url);
  }, [loadUrl]);

  return (
    <div className="browser-app">
      <header className="browser-toolbar">
        <div className="browser-url-row">
          <input
            id="browser-url"
            type="text"
            className="browser-url-input"
            placeholder="Enter URL (e.g. https://martinbibb-cmd.github.io)"
            autoComplete="off"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="browser-btn browser-go-btn"
            onClick={handleGo}
            title="Go"
          >
            Go
          </button>
          <button
            type="button"
            className="browser-btn browser-reload-btn"
            onClick={handleReload}
            title="Reload"
            disabled={!currentUrl || currentUrl === 'about:blank'}
          >
            🔄
          </button>
          <button
            type="button"
            className="browser-btn browser-external-btn"
            onClick={handleOpenExternal}
            title="Open in Safari / External Browser"
            disabled={!currentUrl || currentUrl === 'about:blank'}
          >
            ↗️
          </button>
        </div>

        <div className="browser-presets">
          {presetLinks.map((preset) => (
            <button
              key={preset.url}
              type="button"
              className="browser-preset-btn"
              onClick={() => handlePresetClick(preset.url)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      <main className="browser-content">
        <iframe
          id="browser-frame"
          className="browser-frame"
          src={currentUrl}
          title="Embedded browser"
        />
      </main>

      <footer className="browser-footer">
        <span className="browser-note">
          Note: Some sites may not load due to security restrictions (X-Frame-Options/CSP). 
          Use "↗️" to open in external browser.
        </span>
      </footer>
    </div>
  );
};

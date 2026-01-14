// ATLAS EMERGENCY NEUTRALISATION: Stop Service Worker Interference
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // 1. Unregister all active service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('Atlas: Unregistering SW', registration);
      registration.unregister();
    }
  }).catch((error) => {
    console.error('Atlas: Failed to unregister service workers', error);
  });

  // 2. Clear all named caches to stop "Stale" data reverts
  if ('caches' in window) {
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        console.log('Atlas: Deleting Cache', key);
        return caches.delete(key);
      }));
    }).catch((error) => {
      console.error('Atlas: Failed to clear caches', error);
    });
  }
}

// --- EMERGENCY WHITE-SCREEN DEBUG (remove after fix) ---
(function installFatalOverlay() {
  const show = (title: string, err?: unknown) => {
    const msg =
      err instanceof Error
        ? `${err.message}\n\n${err.stack ?? ""}`
        : typeof err === "string"
          ? err
          : JSON.stringify(err, null, 2);

    document.documentElement.style.background = "#0b0b0b";
    
    // Create overlay using DOM methods to avoid XSS vulnerabilities
    const overlay = document.createElement('div');
    overlay.style.cssText = 'padding:16px;font-family:ui-monospace,Menlo,monospace;color:#ff6b6b;white-space:pre-wrap;';
    
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-weight:800;margin-bottom:10px;';
    titleDiv.textContent = title;
    
    const msgDiv = document.createElement('div');
    msgDiv.textContent = msg;
    
    overlay.appendChild(titleDiv);
    overlay.appendChild(msgDiv);
    document.body.innerHTML = '';
    document.body.appendChild(overlay);
  };

  window.addEventListener("error", (e: ErrorEvent) => {
    show("🔥 FATAL window.error", e.error ?? e.message);
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    show("🔥 FATAL unhandledrejection", e.reason ?? e);
  });

  // breadcrumb that proves main.tsx executed
  console.log("🔥 main.tsx loaded");
})();
// --- END EMERGENCY DEBUG ---

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CognitiveProfileProvider } from './cognitive/CognitiveProfileContext'
import { UiModeProvider } from './ui/UiModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'
import { backgroundTranscriptionProcessor } from './services/backgroundTranscriptionProcessor'

// Register service worker for PWA (PROD only).
// In dev, skip SW registration to avoid "cached old build" pain.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('[SW] New content available, will auto-update.')
      // Show a visible update banner
      showUpdateBanner(() => {
        updateSW(true) // Force immediate update
      })
    },
    onOfflineReady() {
      console.log('[SW] App ready to work offline.')
    },
  })
}

// Update banner for visible PWA updates
function showUpdateBanner(onUpdate: () => void) {
  const banner = document.createElement('div')
  banner.id = 'update-banner'
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1a73e8;
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
  `
  
  const message = document.createElement('span')
  message.textContent = '🔄 Update available'
  
  const button = document.createElement('button')
  button.textContent = 'Reload'
  button.style.cssText = `
    background: white;
    color: #1a73e8;
    border: none;
    padding: 6px 16px;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  `
  button.onclick = () => {
    onUpdate() // This calls updateSW(true) which triggers the update and reload
  }
  
  banner.appendChild(message)
  banner.appendChild(button)
  document.body.appendChild(banner)
}

// Initialize background transcription processor - DELAYED UNTIL AFTER WINDOW LOAD
// This enables continuous transcription even when navigating away from visit pages
// Guarded to only run in real browser context, after page load, to prevent iOS Safari/PWA crashes
try {
  if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
      try {
        console.log("[App] Initializing background transcription processor (delayed)");
        backgroundTranscriptionProcessor.initialize();
      } catch (e) {
        console.error("[Transcription] init failed", e);
      }
    });
  }
} catch (e) {
  console.error("[Transcription] wrapper failed", e);
}

// ========================================================================
// BOOT MARKER - Confirms code execution reaches React initialization
// ========================================================================
console.log('[App] 🚀 Starting React initialization...')
console.log('[App] BUILD_ID:', __APP_VERSION__, 'Built:', __BUILD_TIME__)
console.log('[App] Build timestamp:', new Date(__BUILD_TIME__).toLocaleString())

console.log("🧠 before createRoot");

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found in DOM')
  }

  console.log('[App] ✅ Root element found, creating React root...')

  const root = ReactDOM.createRoot(rootElement)
  
  console.log("🧠 after createRoot");

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <CognitiveProfileProvider>
            <UiModeProvider>
              <App />
            </UiModeProvider>
          </CognitiveProfileProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )

  console.log("✅ after render()");
  console.log('[App] ✅ React root created and rendering')
} catch (error) {
  console.error('[App] Failed to initialize React', error)
  throw error
}

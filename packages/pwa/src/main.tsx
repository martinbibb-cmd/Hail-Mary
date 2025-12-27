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
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'
import { backgroundTranscriptionProcessor } from './services/backgroundTranscriptionProcessor'

// Register service worker for PWA (PROD only).
// In dev, skip SW registration to avoid "cached old build" pain.
if (import.meta.env.PROD) {
  void registerSW({
    onNeedRefresh() {
      console.log('New content available, will auto-update.')
    },
    onOfflineReady() {
      console.log('App ready to work offline.')
    },
  })
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
            <App />
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

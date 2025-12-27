import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CognitiveProfileProvider } from './cognitive/CognitiveProfileContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'
import { backgroundTranscriptionProcessor } from './services/backgroundTranscriptionProcessor'

// ========================================================================
// GLOBAL ERROR HANDLER - Catches errors BEFORE React ErrorBoundary mounts
// ========================================================================
let globalErrorContainer: HTMLDivElement | null = null

function showGlobalError(message: string, error?: Error) {
  console.error('[GlobalErrorHandler]', message, error)

  if (!globalErrorContainer) {
    globalErrorContainer = document.createElement('div')
    globalErrorContainer.id = 'global-error-overlay'
    globalErrorContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #1a1a1a;
      color: #ff4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 999999;
      padding: 20px;
    `

    const content = document.createElement('div')
    content.style.cssText = `
      max-width: 600px;
      text-align: center;
    `

    content.innerHTML = `
      <h1 style="color: #ff4444; margin-bottom: 20px;">⚠️ App Failed to Boot</h1>
      <p style="color: #ccc; margin-bottom: 20px;">${message}</p>
      ${error ? `<pre style="background: #000; padding: 15px; border-radius: 8px; overflow: auto; text-align: left; font-size: 12px;">${error.stack || error.toString()}</pre>` : ''}
      <button id="global-error-reload" style="
        background: #ff4444;
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 8px;
        cursor: pointer;
        margin-top: 20px;
      ">Clear Storage & Reload</button>
    `

    globalErrorContainer.appendChild(content)
    document.body.appendChild(globalErrorContainer)

    document.getElementById('global-error-reload')?.addEventListener('click', () => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        // ignore
      }
      window.location.reload()
    })
  }
}

// Catch synchronous errors
window.addEventListener('error', (event) => {
  showGlobalError('Unhandled runtime error', event.error)
  event.preventDefault()
})

// Catch async errors (Promise rejections)
window.addEventListener('unhandledrejection', (event) => {
  showGlobalError('Unhandled promise rejection', event.reason)
  event.preventDefault()
})

console.log('[App] Global error handlers installed')

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

// Initialize background transcription processor
// This enables continuous transcription even when navigating away from visit pages
console.log('[App] Initializing background transcription processor')

try {
  backgroundTranscriptionProcessor.initialize()
} catch (error) {
  console.error('[App] Failed to initialize background transcription processor:', error)
  // Continue booting - transcription is non-critical
}

// ========================================================================
// BOOT MARKER - Confirms code execution reaches React initialization
// ========================================================================
console.log('[App] 🚀 Starting React initialization...')

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found in DOM')
  }

  console.log('[App] ✅ Root element found, creating React root...')

  ReactDOM.createRoot(rootElement).render(
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

  console.log('[App] ✅ React root created and rendering')

  // Add temporary visual boot marker (removed after 3 seconds)
  const bootMarker = document.createElement('div')
  bootMarker.id = 'boot-marker'
  bootMarker.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: #00ff00;
    color: #000;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 999999;
    pointer-events: none;
  `
  bootMarker.textContent = '✅ APP BOOTED'
  document.body.appendChild(bootMarker)

  setTimeout(() => {
    bootMarker.remove()
  }, 3000)
} catch (error) {
  showGlobalError('Failed to initialize React', error as Error)
  throw error
}

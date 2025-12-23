import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CognitiveProfileProvider } from './cognitive/CognitiveProfileContext'
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

// Initialize background transcription processor
// This enables continuous transcription even when navigating away from visit pages
console.log('[App] Initializing background transcription processor')
backgroundTranscriptionProcessor.initialize()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CognitiveProfileProvider>
        <App />
      </CognitiveProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

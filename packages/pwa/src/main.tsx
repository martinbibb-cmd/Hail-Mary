import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CognitiveProfileProvider } from './cognitive/CognitiveProfileContext'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
void registerSW({
  onNeedRefresh() {
    console.log('New content available, will auto-update.')
  },
  onOfflineReady() {
    console.log('App ready to work offline.')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CognitiveProfileProvider>
        <App />
      </CognitiveProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

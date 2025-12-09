import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { CognitiveProfileProvider } from './cognitive/CognitiveProfileContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CognitiveProfileProvider>
        <App />
      </CognitiveProfileProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

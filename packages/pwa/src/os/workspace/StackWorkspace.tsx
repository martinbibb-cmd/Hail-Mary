/**
 * StackWorkspace Component
 * 
 * Touch-optimized layout for pointer:coarse devices (tablets and mobile).
 * Shows one active panel full-screen with navigation:
 * - Tablets: Horizontal tabs at the top
 * - Mobile: Bottom navigation bar
 */

import React, { useState, useEffect } from 'react'
import { useWindowStore } from '../window-manager/windowStore'
import type { LayoutMode } from '../../hooks/useLayoutMode'
import { ProfileApp } from '../apps/profile/ProfileApp'
import { VisitApp } from '../apps/visit/VisitApp'
import { DiaryApp } from '../apps/diary/DiaryApp'
import { CustomersApp } from '../apps/customers/CustomersApp'
import { LeadsApp } from '../apps/leads/LeadsApp'
import { PhotosApp } from '../apps/photos/PhotosApp'
import { SurveyApp } from '../apps/survey/SurveyApp'
import { QuoteApp } from '../apps/quote/QuoteApp'
import { SettingsApp } from '../apps/settings/SettingsApp'
import { FilesApp } from '../apps/files/FilesApp'
import { BrowserApp } from '../apps/browser/BrowserApp'
import { AboutApp } from '../apps/about/AboutApp'
import { RockyApp } from '../apps/rocky'
import { SarahApp } from '../apps/sarah'
// Mini app modules
import { 
  PropertyApp, 
  CentralHeatingApp, 
  HazardsApp,
  HeatPumpApp,
  SolarPvApp,
  EvApp,
  RoadmapApp,
  OtherTradesApp,
} from '../../modules'
import { MEDIA_RECEIVER_ONLY } from '../../config/featureFlags'
import './StackWorkspace.css'

interface StackWorkspaceProps {
  layout: LayoutMode
  children: React.ReactNode
}

export const StackWorkspace: React.FC<StackWorkspaceProps> = ({ layout, children }) => {
  const windows = useWindowStore((state) => state.windows)
  const focusWindow = useWindowStore((state) => state.focusWindow)
  const closeWindow = useWindowStore((state) => state.closeWindow)
  
  // Find the active window (if any)
  const activeWindow = windows.find(w => w.isActive && w.state !== 'minimized')
  
  // State to control whether panel view or main content is shown
  const [showingPanel, setShowingPanel] = useState(false)
  
  useEffect(() => {
    // Show panel when there's an active window
    setShowingPanel(!!activeWindow)
  }, [activeWindow])
  
  const handleSelectWindow = (windowId: string) => {
    focusWindow(windowId)
    setShowingPanel(true)
  }
  
  const handleClosePanel = () => {
    if (activeWindow) {
      closeWindow(activeWindow.id)
    }
    setShowingPanel(false)
  }
  
  const handleBackToMain = () => {
    setShowingPanel(false)
  }
  
  // Get the app component for the active window
  const getAppComponent = () => {
    if (!activeWindow) return null
    
    // Map app IDs to components
    const DisabledPhotosApp: React.FC = () => (
      <div style={{ padding: 16 }}>
        <h2>Photos capture disabled</h2>
        <p>
          Atlas is running in <strong>receiver-only</strong> mode.
          Use <strong>Import media</strong> on the Visit screen to attach photos/audio/files.
        </p>
      </div>
    )

    const PhotosComponent = MEDIA_RECEIVER_ONLY ? DisabledPhotosApp : PhotosApp

    const appComponents: Record<string, React.ComponentType> = {
      profile: ProfileApp,
      visit: VisitApp,
      diary: DiaryApp,
      customers: CustomersApp,
      leads: LeadsApp,
      photos: PhotosComponent,
      survey: SurveyApp,
      quote: QuoteApp,
      about: AboutApp,
      settings: SettingsApp,
      files: FilesApp,
      browser: BrowserApp,
      rocky: RockyApp,
      sarah: SarahApp,
      // Mini app modules (survey modules)
      property: PropertyApp,
      central_heating: CentralHeatingApp,
      hazards: HazardsApp,
      heat_pump: HeatPumpApp,
      pv: SolarPvApp,
      ev: EvApp,
      roadmap: RoadmapApp,
      other_trades: OtherTradesApp,
    }
    
    const AppComponent = appComponents[activeWindow.appId]
    return AppComponent ? <AppComponent /> : null
  }
  
  const isTablet = layout === 'tablet'
  
  return (
    <div className={`stack-workspace stack-workspace--${layout}`}>
      {/* Full-screen panel view when a window is active */}
      {showingPanel && activeWindow && (
        <div className="stack-panel">
          <div className="stack-panel-header">
            <button 
              className="stack-back-button"
              onClick={handleBackToMain}
              aria-label="Back to main"
            >
              ← Back
            </button>
            <h1 className="stack-panel-title">{activeWindow.title}</h1>
            <button 
              className="stack-close-button"
              onClick={handleClosePanel}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <div className="stack-panel-content">
            {getAppComponent()}
          </div>
        </div>
      )}
      
      {/* Main content view (when no panel is showing) */}
      {!showingPanel && (
        <>
          <div className="stack-main-content">
            {children}
          </div>
          
          {/* Tablet tabs for open windows */}
          {isTablet && windows.length > 0 && (
            <nav className="stack-nav stack-nav--tabs">
              <div className="stack-tabs">
                {windows.filter(w => w.state !== 'minimized').map(window => (
                  <button
                    key={window.id}
                    className={`stack-tab ${window.isActive ? 'stack-tab--active' : ''}`}
                    onClick={() => handleSelectWindow(window.id)}
                  >
                    {window.title}
                    <button
                      className="stack-tab-close"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeWindow(window.id)
                      }}
                      aria-label={`Close ${window.title}`}
                    >
                      ✕
                    </button>
                  </button>
                ))}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

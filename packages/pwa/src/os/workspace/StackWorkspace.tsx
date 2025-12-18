/**
 * StackWorkspace Component
 * 
 * Touch-optimized layout for pointer:coarse devices (tablets and mobile).
 * Shows one active panel full-screen with navigation:
 * - Tablets: Horizontal tabs at the top
 * - Mobile: Bottom navigation bar
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useWindowStore } from '../window-manager/windowStore'
import type { DeviceLayout } from '../../hooks/useDeviceLayout'
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
import { getAllDockApps } from '../dock/Dock'
import './StackWorkspace.css'

interface StackWorkspaceProps {
  layout: DeviceLayout
  children: React.ReactNode
}

export const StackWorkspace: React.FC<StackWorkspaceProps> = ({ layout, children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const windows = useWindowStore((state) => state.windows)
  const openWindow = useWindowStore((state) => state.openWindow)
  const focusWindow = useWindowStore((state) => state.focusWindow)
  const closeWindow = useWindowStore((state) => state.closeWindow)
  
  // Find the active window (if any)
  const activeWindow = windows.find(w => w.isActive && w.state !== 'minimized')
  
  // State to control whether panel view or main content is shown
  const [showingPanel, setShowingPanel] = useState(false)
  
  // State to control mobile menu visibility
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  
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
    const appComponents: Record<string, React.ComponentType> = {
      profile: ProfileApp,
      visit: VisitApp,
      diary: DiaryApp,
      customers: CustomersApp,
      leads: LeadsApp,
      photos: PhotosApp,
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
  
  const isMobile = layout === 'mobile'
  const isTablet = layout === 'tablet'
  
  // Maximum number of items to show in mobile bottom navigation
  const MAX_MOBILE_NAV_ITEMS = 5
  
  // Map app IDs to icons for better visual representation
  const appIcons: Record<string, string> = {
    profile: '👤',
    visit: '🏠',
    diary: '📅',
    customers: '👥',
    leads: '📋',
    photos: '📷',
    survey: '📝',
    quote: '💰',
    settings: '⚙️',
    files: '📁',
    browser: '🌐',
    about: 'ℹ️',
    rocky: '🪨',
    sarah: '🧠',
  }
  
  const getAppIcon = (appId: string) => appIcons[appId] || '📱'
  
  const handleOpenApp = (appId: string, appName: string) => {
    const existingWindow = windows.find(w => w.appId === appId)
    if (existingWindow) {
      focusWindow(existingWindow.id)
    } else {
      openWindow(appId, appName)
    }
    setShowMobileMenu(false)
    setShowingPanel(true)
  }
  
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
          {/* Mobile Menu Button */}
          {isMobile && (
            <button 
              className="mobile-menu-button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle menu"
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          )}
          
          {/* Mobile Menu Overlay */}
          {isMobile && showMobileMenu && (
            <>
              <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)} />
              <div className="mobile-menu-sidebar">
                <div className="mobile-menu-header">
                  <h2>Apps</h2>
                  <button 
                    className="mobile-menu-close"
                    onClick={() => setShowMobileMenu(false)}
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                <div className="mobile-menu-items">
                  {getAllDockApps().filter(app => !app.isSurveyModule).map(app => (
                    <button
                      key={app.id}
                      className="mobile-menu-item"
                      onClick={() => handleOpenApp(app.id, app.name)}
                    >
                      <span className="mobile-menu-icon">{app.icon}</span>
                      <span className="mobile-menu-label">{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          
          <div className="stack-main-content">
            {children}
          </div>
          
          {/* Persistent Bottom Navigation for mobile */}
          {isMobile && (
            <nav className="stack-nav stack-nav--bottom stack-nav--persistent">
              <div className="stack-bottom-nav">
                <button
                  className={`stack-nav-item ${location.pathname === '/' ? 'stack-nav-item--active' : ''}`}
                  onClick={() => navigate('/')}
                >
                  <span className="stack-nav-icon">🏠</span>
                  <span className="stack-nav-label">Home</span>
                </button>
                <button
                  className={`stack-nav-item ${location.pathname === '/profile' ? 'stack-nav-item--active' : ''}`}
                  onClick={() => navigate('/profile')}
                >
                  <span className="stack-nav-icon">👤</span>
                  <span className="stack-nav-label">Profile</span>
                </button>
                <button
                  className={`stack-nav-item ${location.pathname === '/files' ? 'stack-nav-item--active' : ''}`}
                  onClick={() => navigate('/files')}
                >
                  <span className="stack-nav-icon">📁</span>
                  <span className="stack-nav-label">Files</span>
                </button>
              </div>
            </nav>
          )}
          
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

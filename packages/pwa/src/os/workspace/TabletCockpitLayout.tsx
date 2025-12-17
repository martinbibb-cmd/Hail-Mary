/**
 * TabletCockpitLayout Component
 * 
 * Advanced tablet layout with:
 * - Bottom dock for quick module switching
 * - Panel modes: min/half/full
 * - Two-up split view support
 * - Persistent "Active Visit" header
 */

import React from 'react'
import { useTabletLayoutStore } from './tabletLayoutStore'
import { getAllDockApps } from '../dock/Dock'
import { RockyApp } from '../apps/rocky'
import { SarahApp } from '../apps/sarah'
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
import './TabletCockpitLayout.css'

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
}

interface TabletCockpitLayoutProps {
  children: React.ReactNode
}

export const TabletCockpitLayout: React.FC<TabletCockpitLayoutProps> = ({ children }) => {
  const {
    activeModuleId,
    secondaryModuleId,
    panelModes,
    splitMode,
    setActiveModule,
    setSecondaryModule,
    setPanelMode,
    setSplitMode,
  } = useTabletLayoutStore()

  const dockApps = getAllDockApps().filter(app => !app.isSurveyModule)

  const handleDockClick = (appId: string) => {
    if (activeModuleId === appId) {
      // Toggle panel mode: full -> half -> min -> full
      const currentMode = panelModes[appId] || 'min'
      if (currentMode === 'min') {
        setPanelMode(appId, 'half')
      } else if (currentMode === 'half') {
        setPanelMode(appId, 'full')
      } else {
        setPanelMode(appId, 'min')
      }
    } else {
      // Set as active and show in half mode
      setActiveModule(appId)
      setPanelMode(appId, 'half')
    }
  }

  const handleSplitToggle = () => {
    if (splitMode === 'none') {
      setSplitMode('two-up')
      // Set secondary module to first non-active app
      const firstOtherApp = dockApps.find(app => app.id !== activeModuleId)
      if (firstOtherApp) {
        setSecondaryModule(firstOtherApp.id)
        setPanelMode(firstOtherApp.id, 'half')
      }
    } else {
      setSplitMode('none')
      setSecondaryModule(null)
    }
  }

  const renderModule = (moduleId: string | null) => {
    if (!moduleId) return null
    const AppComponent = appComponents[moduleId]
    return AppComponent ? <AppComponent /> : null
  }

  const primaryMode = activeModuleId ? panelModes[activeModuleId] || 'min' : 'min'
  const secondaryMode = secondaryModuleId ? panelModes[secondaryModuleId] || 'min' : 'min'

  const showPrimary = activeModuleId && primaryMode !== 'min'
  const showSecondary = secondaryModuleId && secondaryMode !== 'min' && splitMode === 'two-up'

  return (
    <div className="tablet-cockpit">
      {/* Active Visit Header */}
      <div className="cockpit-header">
        <div className="cockpit-header-content">
          <span className="cockpit-visit-label">Active Visit:</span>
          <span className="cockpit-visit-name">123 Main Street</span>
          <button 
            className="cockpit-split-button"
            onClick={handleSplitToggle}
            aria-label={splitMode === 'none' ? 'Enable split view' : 'Disable split view'}
          >
            {splitMode === 'none' ? '⊞ Split' : '⊟ Single'}
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className={`cockpit-workspace cockpit-workspace--${splitMode}`}>
        {/* Main content area (when no panels or minimized) */}
        {!showPrimary && !showSecondary && (
          <div className="cockpit-main-content">
            {children}
          </div>
        )}

        {/* Primary panel */}
        {showPrimary && (
          <div className={`cockpit-panel cockpit-panel--${primaryMode} ${splitMode === 'two-up' && showSecondary ? 'cockpit-panel--left' : ''}`}>
            <div className="cockpit-panel-header">
              <h2 className="cockpit-panel-title">
                {dockApps.find(app => app.id === activeModuleId)?.name}
              </h2>
              <div className="cockpit-panel-controls">
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(activeModuleId!, 'half')}
                  disabled={primaryMode === 'half'}
                  aria-label="Half size"
                >
                  ▭
                </button>
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(activeModuleId!, 'full')}
                  disabled={primaryMode === 'full'}
                  aria-label="Full size"
                >
                  ▢
                </button>
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(activeModuleId!, 'min')}
                  aria-label="Minimize"
                >
                  ▬
                </button>
              </div>
            </div>
            <div className="cockpit-panel-content">
              {renderModule(activeModuleId)}
            </div>
          </div>
        )}

        {/* Secondary panel (two-up mode) */}
        {showSecondary && (
          <div className={`cockpit-panel cockpit-panel--${secondaryMode} cockpit-panel--right`}>
            <div className="cockpit-panel-header">
              <h2 className="cockpit-panel-title">
                {dockApps.find(app => app.id === secondaryModuleId)?.name}
              </h2>
              <div className="cockpit-panel-controls">
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(secondaryModuleId!, 'half')}
                  disabled={secondaryMode === 'half'}
                  aria-label="Half size"
                >
                  ▭
                </button>
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(secondaryModuleId!, 'full')}
                  disabled={secondaryMode === 'full'}
                  aria-label="Full size"
                >
                  ▢
                </button>
                <button
                  className="cockpit-panel-control"
                  onClick={() => setPanelMode(secondaryModuleId!, 'min')}
                  aria-label="Minimize"
                >
                  ▬
                </button>
              </div>
            </div>
            <div className="cockpit-panel-content">
              {renderModule(secondaryModuleId)}
            </div>
          </div>
        )}

        {/* Background content (visible through half-panels) */}
        {(showPrimary || showSecondary) && (primaryMode === 'half' || secondaryMode === 'half') && (
          <div className="cockpit-background-content">
            {children}
          </div>
        )}
      </div>

      {/* Bottom Dock */}
      <div className="cockpit-dock">
        <div className="cockpit-dock-container">
          {dockApps.map((app) => {
            const isActive = app.id === activeModuleId || app.id === secondaryModuleId
            const mode = panelModes[app.id] || 'min'
            return (
              <button
                key={app.id}
                className={`cockpit-dock-item ${isActive ? 'cockpit-dock-item--active' : ''} ${mode !== 'min' ? 'cockpit-dock-item--open' : ''}`}
                onClick={() => handleDockClick(app.id)}
                aria-label={app.name}
                title={app.name}
              >
                <span className="cockpit-dock-icon">{app.icon}</span>
                {mode !== 'min' && <span className="cockpit-dock-indicator" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

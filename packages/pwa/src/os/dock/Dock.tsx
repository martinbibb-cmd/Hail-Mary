import React from 'react'
import { motion } from 'framer-motion'
import { useWindowStore } from '../window-manager'
import './Dock.css'

export interface DockApp {
  id: string
  name: string
  icon: string
  /** Optional: marks survey module tabs */
  isSurveyModule?: boolean
}

const dockApps: DockApp[] = [
  { id: 'profile', name: 'Profile', icon: '👤' },
  { id: 'visit', name: 'Visit / Notes', icon: '📋' },
  { id: 'diary', name: 'Diary', icon: '🗓' },
  { id: 'photos', name: 'Photos', icon: '📸' },
  { id: 'files', name: 'Files', icon: '📂' },
  { id: 'survey', name: 'Survey', icon: '🧩' },
  { id: 'quote', name: 'Quote', icon: '£' },
  { id: 'customers', name: 'Customers', icon: '📁' },
  { id: 'leads', name: 'Leads', icon: '🧲' },
  { id: 'assistant', name: 'Sarah', icon: '🧠' },
  { id: 'browser', name: 'Browser', icon: '🌐' },
  { id: 'about', name: 'About', icon: 'ℹ️' },
  // Settings must always remain last (far right)
  { id: 'settings', name: 'Settings', icon: '⚙️' },
]

/**
 * Survey module apps - available as tabs within the survey view
 * These match the mini app architecture described in the spec.
 */
export const surveyModuleApps: DockApp[] = [
  { id: 'property', name: 'Property', icon: '🏠', isSurveyModule: true },
  { id: 'central_heating', name: 'Boiler / CH', icon: '🔥', isSurveyModule: true },
  { id: 'heat_pump', name: 'Heat Pump', icon: '♨️', isSurveyModule: true },
  { id: 'pv', name: 'Solar PV', icon: '☀️', isSurveyModule: true },
  { id: 'ev', name: 'EV Charging', icon: '🔌', isSurveyModule: true },
  { id: 'hazards', name: 'Hazards', icon: '⚠️', isSurveyModule: true },
  { id: 'roadmap', name: 'Roadmap', icon: '🗺️', isSurveyModule: true },
  { id: 'other_trades', name: 'Other', icon: '🔧', isSurveyModule: true },
]

/** Get all dock apps including survey modules */
export const getAllDockApps = () => [...dockApps, ...surveyModuleApps]

export const Dock: React.FC = () => {
  const openWindow = useWindowStore((state) => state.openWindow)
  const windows = useWindowStore((state) => state.windows)
  const restoreWindow = useWindowStore((state) => state.restoreWindow)
  const focusWindow = useWindowStore((state) => state.focusWindow)

  const handleAppClick = (app: DockApp) => {
    const existingWindow = windows.find(w => w.appId === app.id)
    if (existingWindow) {
      if (existingWindow.state === 'minimized') {
        restoreWindow(existingWindow.id)
      } else {
        focusWindow(existingWindow.id)
      }
    } else {
      openWindow(app.id, app.name)
    }
  }

  const isAppOpen = (appId: string) => windows.some(w => w.appId === appId)
  const isAppMinimized = (appId: string) => 
    windows.some(w => w.appId === appId && w.state === 'minimized')
  const isAppActive = (appId: string) => 
    windows.some(w => w.appId === appId && w.isActive && w.state !== 'minimized')

  return (
    <motion.div 
      className="os-dock"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
    >
      <div className="os-dock-container">
        {dockApps.map((app) => (
          <motion.button
            key={app.id}
            className={`os-dock-item ${isAppOpen(app.id) ? 'open' : ''} ${isAppActive(app.id) ? 'active' : ''}`}
            onClick={() => handleAppClick(app)}
            whileHover={{ scale: 1.15, y: -8 }}
            whileTap={{ scale: 0.95 }}
            title={app.name}
          >
            <span className="os-dock-icon">{app.icon}</span>
            {isAppOpen(app.id) && (
              <span className={`os-dock-indicator ${isAppMinimized(app.id) ? 'minimized' : ''}`} />
            )}
          </motion.button>
        ))}
      </div>

      {/* Minimized windows indicator */}
      {windows.filter(w => w.state === 'minimized').length > 0 && (
        <div className="os-dock-minimized">
          {windows
            .filter(w => w.state === 'minimized')
            .map((w) => (
              <motion.button
                key={w.id}
                className="os-dock-minimized-item"
                onClick={() => restoreWindow(w.id)}
                whileHover={{ scale: 1.1 }}
                title={`Restore ${w.title}`}
              >
                <span className="os-dock-minimized-preview">
                  {getAllDockApps().find(a => a.id === w.appId)?.icon || '📄'}
                </span>
              </motion.button>
            ))}
        </div>
      )}
    </motion.div>
  )
}

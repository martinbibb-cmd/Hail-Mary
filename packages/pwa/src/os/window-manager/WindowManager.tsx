import React from 'react'
import { AnimatePresence } from 'framer-motion'
import { useWindowStore } from './windowStore'
import { Window } from './Window'
import { VisitApp } from '../apps/visit/VisitApp'
import { DiaryApp } from '../apps/diary/DiaryApp'
import './WindowManager.css'

// Map app IDs to components
const appComponents: Record<string, React.FC> = {
  visit: VisitApp,
  diary: DiaryApp,
}

export const WindowManager: React.FC = () => {
  const windows = useWindowStore((state) => state.windows)

  return (
    <div className="os-window-manager">
      <AnimatePresence>
        {windows.map((window) => {
          const AppComponent = appComponents[window.appId]
          if (!AppComponent) return null

          return (
            <Window key={window.id} window={window}>
              <AppComponent />
            </Window>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

import React from 'react'
import { AnimatePresence } from 'framer-motion'
import { useWindowStore } from './windowStore'
import { Window } from './Window'
import { ProfileApp } from '../apps/profile/ProfileApp'
import { VisitApp } from '../apps/visit/VisitApp'
import { DiaryApp } from '../apps/diary/DiaryApp'
import { CustomersApp } from '../apps/customers/CustomersApp'
import { LeadsApp } from '../apps/leads/LeadsApp'
import { PhotosApp } from '../apps/photos/PhotosApp'
import { SurveyApp } from '../apps/survey/SurveyApp'
import { QuoteApp } from '../apps/quote/QuoteApp'
import './WindowManager.css'

// Map app IDs to components
const appComponents: Record<string, React.FC> = {
  profile: ProfileApp,
  visit: VisitApp,
  diary: DiaryApp,
  customers: CustomersApp,
  leads: LeadsApp,
  photos: PhotosApp,
  survey: SurveyApp,
  quote: QuoteApp,
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

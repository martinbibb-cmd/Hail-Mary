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
import { SettingsApp } from '../apps/settings/SettingsApp'
import { FilesApp } from '../apps/files/FilesApp'
import { BrowserApp } from '../apps/browser/BrowserApp'
import { AboutApp } from '../apps/about/AboutApp'
import { RockyApp } from '../apps/rocky'
import { SarahApp } from '../apps/sarah'
import { MEDIA_RECEIVER_ONLY } from '../../config/featureFlags'
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
import './WindowManager.css'

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

const appComponents: Record<string, React.FC> = {
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

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CognitiveProfile = 'standard' | 'focus' | 'clarity' | 'calm'
export type SttProvider = 'browser' | 'whisper'

export interface CognitiveProfileSettings {
  profile: CognitiveProfile
  focusTimers: boolean
  bionicReading: boolean
  calmSafeMode: boolean
  sttProvider: SttProvider
}

interface CognitiveProfileContextValue {
  profile: CognitiveProfile
  settings: CognitiveProfileSettings
  setProfile: (profile: CognitiveProfile) => void
  updateSettings: (settings: Partial<CognitiveProfileSettings>) => void
}

const STORAGE_KEY = 'hailmary.cognitiveProfile'

const defaultSettings: CognitiveProfileSettings = {
  profile: 'standard',
  focusTimers: true,
  bionicReading: true,
  calmSafeMode: true,
  sttProvider: 'browser',
}

const CognitiveProfileContext = createContext<CognitiveProfileContextValue | null>(null)

const parseStoredSettings = (): CognitiveProfileSettings => {
  if (typeof window === 'undefined') return defaultSettings

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return defaultSettings

  try {
    const parsed = JSON.parse(stored)
    return {
      ...defaultSettings,
      ...parsed,
    }
  } catch (error) {
    console.warn('Unable to read cognitive profile settings, using defaults', error)
    return defaultSettings
  }
}

export const useCognitiveProfile = (): CognitiveProfileContextValue => {
  const context = useContext(CognitiveProfileContext)
  if (!context) {
    throw new Error('useCognitiveProfile must be used within a CognitiveProfileProvider')
  }
  return context
}

export const CognitiveProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CognitiveProfileSettings>(parseStoredSettings)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const profiles = ['standard', 'focus', 'clarity', 'calm'] as const
    profiles.forEach((profile) => {
      document.body.classList.remove(`profile-${profile}`)
    })
    document.body.classList.add(`profile-${settings.profile}`)
  }, [settings.profile])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle(
      'bionic-reading-active',
      settings.profile === 'clarity' && settings.bionicReading,
    )
  }, [settings.profile, settings.bionicReading])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle(
      'calm-safe-mode',
      settings.profile === 'calm' && settings.calmSafeMode,
    )
  }, [settings.profile, settings.calmSafeMode])

  const value = useMemo<CognitiveProfileContextValue>(
    () => ({
      profile: settings.profile,
      settings,
      setProfile: (profile) => setSettings((prev) => ({ ...prev, profile })),
      updateSettings: (newSettings) => setSettings((prev) => ({ ...prev, ...newSettings })),
    }),
    [settings],
  )

  return (
    <CognitiveProfileContext.Provider value={value}>
      {children}
    </CognitiveProfileContext.Provider>
  )
}

export const cognitiveProfiles: Array<{
  id: CognitiveProfile
  label: string
  intent: string
  highlights: string
}> = [
  {
    id: 'focus',
    label: 'Laser Focus',
    intent: 'ADHD / Executive Dysfunction',
    highlights: 'Hides clutter, adds visual timers and a parking lot for stray ideas.',
  },
  {
    id: 'clarity',
    label: 'Clarity',
    intent: 'Dyslexia / Visual Processing',
    highlights: 'Dyslexia-friendly fonts, bionic reading emphasis, larger hit areas.',
  },
  {
    id: 'calm',
    label: 'Calm',
    intent: 'Anxiety / OCD / Overstimulation',
    highlights: 'Muted palette, softer alerts, and safer destructive actions.',
  },
  {
    id: 'standard',
    label: 'Standard',
    intent: 'Default',
    highlights: 'Original layout and color system.',
  },
]


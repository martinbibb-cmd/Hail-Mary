import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LayoutMode, useLayoutMode } from '../hooks/useLayoutMode'
import { UiMode, getUiMode, setUiMode as saveUiMode, resolveLayoutMode } from './uiMode'

interface UiModeContextValue {
  /** The user's selected UI mode preference */
  uiMode: UiMode
  /** The automatically detected layout based on device capabilities */
  autoDetectedLayout: LayoutMode
  /** The effective layout mode to use (after applying user preference) */
  effectiveLayout: LayoutMode
  /** Update the UI mode preference */
  setUiMode: (mode: UiMode) => void
}

const UiModeContext = createContext<UiModeContextValue | null>(null)

/**
 * Hook to access UI mode context.
 * Provides both the user's preference and the effective layout to use.
 */
export const useUiMode = (): UiModeContextValue => {
  const context = useContext(UiModeContext)
  if (!context) {
    throw new Error('useUiMode must be used within a UiModeProvider')
  }
  return context
}

interface UiModeProviderProps {
  children: React.ReactNode
}

/**
 * Provider for UI mode management.
 * Wraps the automatic layout detection with user preference override capability.
 */
export const UiModeProvider: React.FC<UiModeProviderProps> = ({ children }) => {
  // Get the user's saved preference
  const [uiMode, setUiModeState] = useState<UiMode>(getUiMode)

  // Get the automatically detected layout from device capabilities
  const autoDetectedLayout = useLayoutMode()

  // Calculate the effective layout based on user preference + auto-detection
  const effectiveLayout = useMemo(
    () => resolveLayoutMode(uiMode, autoDetectedLayout),
    [uiMode, autoDetectedLayout]
  )

  // Save to localStorage whenever UI mode changes
  useEffect(() => {
    saveUiMode(uiMode)
  }, [uiMode])

  // Apply CSS data attribute to document for styling
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Set data-ui attribute based on effective layout
    const uiType = effectiveLayout === 'desktop' ? 'wimp' : 'touch'
    document.documentElement.setAttribute('data-ui', uiType)

    // Also set data-layout for more granular styling if needed
    document.documentElement.setAttribute('data-layout', effectiveLayout)
  }, [effectiveLayout])

  const value = useMemo<UiModeContextValue>(
    () => ({
      uiMode,
      autoDetectedLayout,
      effectiveLayout,
      setUiMode: setUiModeState,
    }),
    [uiMode, autoDetectedLayout, effectiveLayout]
  )

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>
}

/**
 * Interface for UI mode option metadata
 */
export interface UiModeOption {
  id: UiMode
  label: string
  description: string
  badge?: string
}

/**
 * Metadata for UI mode options (for display in settings)
 */
export const uiModeOptions: readonly UiModeOption[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Automatically detect based on pointer type (recommended)',
    badge: 'Recommended',
  },
  {
    id: 'touch',
    label: 'Touch',
    description: 'Touch-optimized interface with larger hit targets',
  },
  {
    id: 'wimp',
    label: 'Desktop',
    description: 'Mouse/keyboard interface with compact layout',
  },
]

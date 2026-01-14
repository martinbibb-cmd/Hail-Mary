/**
 * UI Mode system for Atlas
 *
 * Provides user-selectable UI modes that work on top of automatic layout detection:
 * - Auto: Automatically detect based on pointer type (recommended)
 * - Touch: Force touch-optimized UI (StackWorkspace)
 * - WIMP: Force desktop UI (DesktopWorkspace)
 */

import { LayoutMode } from '../hooks/useLayoutMode'

export type UiMode = 'auto' | 'touch' | 'wimp'

const UI_MODE_STORAGE_KEY = 'hailmary.uiMode'

/**
 * Detect the preferred UI mode based on device capabilities.
 * Uses CSS media queries to detect pointer precision and hover capability.
 *
 * @returns 'wimp' if fine pointer + hover detected, otherwise 'touch'
 */
export function detectPreferredUiMode(): 'touch' | 'wimp' {
  if (typeof window === 'undefined') {
    return 'wimp' // SSR fallback
  }

  // Check for any fine pointer (mouse/trackpad)
  const hasAnyFinePointer = window.matchMedia('(any-pointer: fine)').matches
  // Check for hover capability
  const hasHover = window.matchMedia('(hover: hover)').matches

  // If both fine pointer and hover are present, suggest WIMP
  if (hasAnyFinePointer && hasHover) {
    return 'wimp'
  }

  return 'touch'
}

/**
 * Get the user's preferred UI mode from localStorage.
 * Defaults to 'auto' if not set or invalid.
 */
export function getUiMode(): UiMode {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  try {
    const stored = localStorage.getItem(UI_MODE_STORAGE_KEY)
    if (stored === 'auto' || stored === 'touch' || stored === 'wimp') {
      return stored
    }
  } catch (err) {
    console.warn('Failed to read UI mode from localStorage:', err)
  }

  return 'auto'
}

/**
 * Save the user's preferred UI mode to localStorage.
 */
export function setUiMode(mode: UiMode): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode)
  } catch (err) {
    console.error('Failed to save UI mode to localStorage:', err)
  }
}

/**
 * Resolve the effective layout mode based on UI mode preference and auto-detection.
 *
 * @param uiMode - User's UI mode preference
 * @param autoDetectedLayout - The automatically detected layout mode
 * @returns The effective layout mode to use
 */
export function resolveLayoutMode(
  uiMode: UiMode,
  autoDetectedLayout: LayoutMode
): LayoutMode {
  if (uiMode === 'wimp') {
    return 'desktop'
  }

  if (uiMode === 'touch') {
    // When forcing touch mode, preserve tablet vs mobile distinction
    return autoDetectedLayout === 'desktop' ? 'tablet' : autoDetectedLayout
  }

  // Auto mode - use whatever was detected
  return autoDetectedLayout
}

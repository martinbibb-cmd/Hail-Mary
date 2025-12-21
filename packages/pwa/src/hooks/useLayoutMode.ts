import { useState, useEffect, useRef } from 'react'

export type LayoutMode = 'desktop' | 'tablet' | 'mobile'

/**
 * Hook to detect device layout mode based on pointer type and screen width.
 * Includes stability mechanisms to prevent flickering on tablets.
 * 
 * ## Stability Features:
 * 
 * 1. **Debouncing**: Resize events are debounced by 150ms to prevent rapid
 *    recalculations during window resizing or orientation changes.
 * 
 * 2. **Hysteresis**: Different thresholds are used for transitioning between
 *    mobile and tablet modes:
 *    - Mobile → Tablet: triggers at 900px (upper threshold)
 *    - Tablet → Mobile: triggers at 850px (lower threshold)
 *    This 50px "dead zone" prevents flickering when the window size
 *    hovers near a single threshold.
 * 
 * 3. **Pointer Detection**: Desktop mode is determined by pointer type
 *    (fine pointer = mouse/trackpad), which is stable and doesn't change
 *    during resize events.
 * 
 * @returns LayoutMode type:
 *   - 'desktop': pointer:fine (mouse/trackpad) - uses WIMP desktop interface
 *   - 'tablet': pointer:coarse + width >= 900px - uses Stack UI with tabs
 *   - 'mobile': pointer:coarse + width < 900px - uses Stack UI with bottom nav
 */
export function useLayoutMode(): LayoutMode {
  const [layout, setLayout] = useState<LayoutMode>(() => {
    return getLayoutMode()
  })
  
  // Use ref to track the last layout to implement hysteresis
  const lastLayoutRef = useRef<LayoutMode>(layout)
  const debounceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handleResize = () => {
      // Clear any pending debounce timer
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
      
      // Debounce the layout calculation to prevent rapid changes
      debounceTimerRef.current = window.setTimeout(() => {
        const newLayout = getLayoutMode(lastLayoutRef.current)
        if (newLayout !== lastLayoutRef.current) {
          lastLayoutRef.current = newLayout
          setLayout(newLayout)
        }
      }, 150) // 150ms debounce to smooth out resize events
    }

    // Listen for resize events
    window.addEventListener('resize', handleResize)
    
    // Also listen for orientation changes on mobile devices
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return layout
}

/**
 * Determine the current layout mode based on pointer type and screen width.
 * Implements hysteresis to prevent flickering near threshold boundaries.
 * 
 * @param currentLayout - The current layout mode (for hysteresis)
 */
function getLayoutMode(currentLayout?: LayoutMode): LayoutMode {
  // Guard against SSR - default to desktop if window is not available
  if (typeof window === 'undefined') {
    return 'desktop'
  }
  
  // Check if the device has fine pointer (mouse/trackpad)
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  
  if (hasFinePointer) {
    return 'desktop'
  }
  
  // Device has coarse pointer (touch), determine if tablet or mobile based on width
  const width = window.innerWidth
  
  // Implement hysteresis to prevent flickering
  // Use different thresholds depending on current state
  const TABLET_THRESHOLD_UP = 900   // Switch from mobile to tablet at 900px
  const TABLET_THRESHOLD_DOWN = 850 // Switch from tablet to mobile at 850px
  
  // If we have a current layout, use hysteresis
  if (currentLayout === 'tablet') {
    // Stay in tablet mode until we drop below the lower threshold
    return width >= TABLET_THRESHOLD_DOWN ? 'tablet' : 'mobile'
  } else if (currentLayout === 'mobile') {
    // Stay in mobile mode until we rise above the upper threshold
    return width >= TABLET_THRESHOLD_UP ? 'tablet' : 'mobile'
  }
  
  // No current layout (initial state), use the upper threshold
  return width >= TABLET_THRESHOLD_UP ? 'tablet' : 'mobile'
}

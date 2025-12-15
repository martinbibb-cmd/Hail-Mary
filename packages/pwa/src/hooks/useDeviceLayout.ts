import { useState, useEffect } from 'react'

export type DeviceLayout = 'desktop' | 'tablet' | 'mobile'

/**
 * Hook to detect device layout capabilities based on pointer type and screen width
 * 
 * @returns DeviceLayout type:
 *   - 'desktop': pointer:fine (mouse/trackpad) - uses WIMP desktop interface
 *   - 'tablet': pointer:coarse + width >= 900px - uses Stack UI with tabs
 *   - 'mobile': pointer:coarse + width < 900px - uses Stack UI with bottom nav
 */
export function useDeviceLayout(): DeviceLayout {
  const [layout, setLayout] = useState<DeviceLayout>(() => {
    return getDeviceLayout()
  })

  useEffect(() => {
    const handleResize = () => {
      setLayout(getDeviceLayout())
    }

    // Listen for resize events
    window.addEventListener('resize', handleResize)
    
    // Also listen for orientation changes on mobile devices
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  return layout
}

/**
 * Determine the current device layout based on pointer type and screen width
 */
function getDeviceLayout(): DeviceLayout {
  // Check if the device has fine pointer (mouse/trackpad)
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches
  
  if (hasFinePointer) {
    return 'desktop'
  }
  
  // Device has coarse pointer (touch), determine if tablet or mobile based on width
  const width = window.innerWidth
  const TABLET_THRESHOLD = 900
  
  return width >= TABLET_THRESHOLD ? 'tablet' : 'mobile'
}

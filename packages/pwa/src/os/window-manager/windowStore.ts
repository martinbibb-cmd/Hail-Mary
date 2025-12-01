import { create } from 'zustand'

export type WindowState = 'normal' | 'minimized' | 'maximized' | 'left' | 'right'

export interface WindowData {
  id: string
  appId: string
  title: string
  x: number
  y: number
  width: number
  height: number
  state: WindowState
  zIndex: number
  isActive: boolean
}

interface WindowStore {
  windows: WindowData[]
  nextZIndex: number
  openWindow: (appId: string, title: string) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  maximizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
  snapLeft: (id: string) => void
  snapRight: (id: string) => void
  updatePosition: (id: string, x: number, y: number) => void
  updateSize: (id: string, width: number, height: number) => void
  getActiveWindows: () => WindowData[]
  getMinimizedWindows: () => WindowData[]
  isAppOpen: (appId: string) => boolean
}

// Default window dimensions
const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

// Calculate default position for new window
const getDefaultPosition = (index: number) => ({
  x: 100 + (index * 30),
  y: 80 + (index * 30),
})

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  nextZIndex: 1,

  openWindow: (appId: string, title: string) => {
    const { windows, nextZIndex, isAppOpen, focusWindow } = get()
    
    // If app already open, just focus it
    if (isAppOpen(appId)) {
      const existingWindow = windows.find(w => w.appId === appId)
      if (existingWindow) {
        focusWindow(existingWindow.id)
        // Restore if minimized
        if (existingWindow.state === 'minimized') {
          set((state) => ({
            windows: state.windows.map(w =>
              w.id === existingWindow.id ? { ...w, state: 'normal' as WindowState } : w
            ),
          }))
        }
      }
      return
    }

    const position = getDefaultPosition(windows.length)
    const newWindow: WindowData = {
      id: `window-${Date.now()}-${appId}`,
      appId,
      title,
      x: position.x,
      y: position.y,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      state: 'normal',
      zIndex: nextZIndex,
      isActive: true,
    }

    set((state) => ({
      windows: [
        ...state.windows.map(w => ({ ...w, isActive: false })),
        newWindow,
      ],
      nextZIndex: state.nextZIndex + 1,
    }))
  },

  closeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.filter(w => w.id !== id),
    }))
  },

  focusWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map(w => ({
        ...w,
        isActive: w.id === id,
        zIndex: w.id === id ? state.nextZIndex : w.zIndex,
      })),
      nextZIndex: state.nextZIndex + 1,
    }))
  },

  minimizeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, state: 'minimized' as WindowState, isActive: false } : w
      ),
    }))
  },

  maximizeWindow: (id: string) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id
          ? { ...w, state: w.state === 'maximized' ? 'normal' : 'maximized' }
          : w
      ),
    }))
  },

  restoreWindow: (id: string) => {
    const { focusWindow } = get()
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, state: 'normal' as WindowState } : w
      ),
    }))
    focusWindow(id)
  },

  snapLeft: (id: string) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, state: 'left' as WindowState } : w
      ),
    }))
  },

  snapRight: (id: string) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, state: 'right' as WindowState } : w
      ),
    }))
  },

  updatePosition: (id: string, x: number, y: number) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, x, y, state: 'normal' as WindowState } : w
      ),
    }))
  },

  updateSize: (id: string, width: number, height: number) => {
    set((state) => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, width, height } : w
      ),
    }))
  },

  getActiveWindows: () => {
    return get().windows.filter(w => w.state !== 'minimized')
  },

  getMinimizedWindows: () => {
    return get().windows.filter(w => w.state === 'minimized')
  },

  isAppOpen: (appId: string) => {
    return get().windows.some(w => w.appId === appId)
  },
}))

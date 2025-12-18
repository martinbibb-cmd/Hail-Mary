/**
 * Tablet Layout Store
 * 
 * Zustand store for managing tablet cockpit layout state:
 * - Active and secondary modules
 * - Panel modes (min/half/full)
 * - Split view mode
 */

import { create } from 'zustand'

export type PanelMode = 'min' | 'half' | 'full'
export type SplitMode = 'none' | 'two-up'

interface TabletLayoutState {
  // Active module in primary position
  activeModuleId: string | null
  
  // Secondary module (for two-up split view)
  secondaryModuleId: string | null
  
  // Panel modes for each module
  panelModes: Record<string, PanelMode>
  
  // Split mode
  splitMode: SplitMode
  
  // Actions
  setActiveModule: (moduleId: string | null) => void
  setSecondaryModule: (moduleId: string | null) => void
  setPanelMode: (moduleId: string, mode: PanelMode) => void
  setSplitMode: (mode: SplitMode) => void
}

export const useTabletLayoutStore = create<TabletLayoutState>((set) => ({
  activeModuleId: null,
  secondaryModuleId: null,
  panelModes: {},
  splitMode: 'none',
  
  setActiveModule: (moduleId) => set({ activeModuleId: moduleId }),
  
  setSecondaryModule: (moduleId) => set({ secondaryModuleId: moduleId }),
  
  setPanelMode: (moduleId, mode) => set((state) => ({
    panelModes: {
      ...state.panelModes,
      [moduleId]: mode,
    },
  })),
  
  setSplitMode: (mode) => set({ splitMode: mode }),
}))

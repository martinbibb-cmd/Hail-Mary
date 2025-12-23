import { create } from 'zustand'

export interface ActivePropertySummary {
  id: string
  addressLine1: string
  addressLine2?: string | null
  town?: string | null
  postcode: string
}

interface SpineStoreState {
  activeProperty: ActivePropertySummary | null
  setActiveProperty: (property: ActivePropertySummary) => void
  clearActiveProperty: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'hail-mary:v2-spine-store'

export const useSpineStore = create<SpineStoreState>((set) => ({
  activeProperty: null,

  setActiveProperty: (property) => {
    set({ activeProperty: property })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeProperty: property }))
    } catch {
      // ignore
    }
  },

  clearActiveProperty: () => {
    set({ activeProperty: null })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeProperty: null }))
    } catch {
      // ignore
    }
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { activeProperty?: ActivePropertySummary | null }
      if (parsed && 'activeProperty' in parsed) {
        set({ activeProperty: parsed.activeProperty ?? null })
      }
    } catch {
      // ignore
    }
  },
}))


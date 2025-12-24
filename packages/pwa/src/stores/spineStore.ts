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
  activeVisitId: string | null
  setActiveProperty: (property: ActivePropertySummary) => void
  clearActiveProperty: () => void
  setActiveVisitId: (visitId: string) => void
  clearActiveVisit: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'hail-mary:v2-spine-store'

export const useSpineStore = create<SpineStoreState>((set) => ({
  activeProperty: null,
  activeVisitId: null,

  setActiveProperty: (property) => {
    set((prev) => ({
      activeProperty: property,
      // If property changes, any previous active visit is no longer safe to use.
      activeVisitId: prev.activeProperty?.id === property.id ? prev.activeVisitId : null,
    }))
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const prev = raw ? (JSON.parse(raw) as any) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, activeProperty: property, activeVisitId: prev?.activeProperty?.id === property.id ? prev.activeVisitId : null }))
    } catch {
      // ignore
    }
  },

  clearActiveProperty: () => {
    set({ activeProperty: null, activeVisitId: null })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeProperty: null, activeVisitId: null }))
    } catch {
      // ignore
    }
  },

  setActiveVisitId: (visitId) => {
    set({ activeVisitId: visitId })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const prev = raw ? (JSON.parse(raw) as any) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, activeVisitId: visitId }))
    } catch {
      // ignore
    }
  },

  clearActiveVisit: () => {
    set({ activeVisitId: null })
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const prev = raw ? (JSON.parse(raw) as any) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, activeVisitId: null }))
    } catch {
      // ignore
    }
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { activeProperty?: ActivePropertySummary | null; activeVisitId?: string | null }
      set({
        activeProperty: parsed?.activeProperty ?? null,
        activeVisitId: parsed?.activeVisitId ?? null,
      })
    } catch {
      // ignore
    }
  },
}))


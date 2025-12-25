import { create } from 'zustand'

export interface ActiveAddressSummary {
  id: string
  line1: string
  line2?: string | null
  town?: string | null
  postcode: string
  customerName?: string | null
}

interface SpineStoreState {
  activeAddress: ActiveAddressSummary | null
  activeVisitId: string | null
  setActiveAddress: (address: ActiveAddressSummary) => void
  clearActiveAddress: () => void
  setActiveVisitId: (visitId: string) => void
  clearActiveVisit: () => void
  hydrate: () => void
}

const STORAGE_KEY = 'hail-mary:v2-spine-store'

export const useSpineStore = create<SpineStoreState>((set) => ({
  activeAddress: null,
  activeVisitId: null,

  setActiveAddress: (address) => {
    set((prev) => ({
      activeAddress: address,
      // If address changes, any previous active visit is no longer safe to use.
      activeVisitId: prev.activeAddress?.id === address.id ? prev.activeVisitId : null,
    }))
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const prev = raw ? (JSON.parse(raw) as any) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, activeAddress: address, activeVisitId: prev?.activeAddress?.id === address.id ? prev.activeVisitId : null }))
    } catch {
      // ignore
    }
  },

  clearActiveAddress: () => {
    set({ activeAddress: null, activeVisitId: null })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeAddress: null, activeVisitId: null }))
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
      const parsed = JSON.parse(raw) as { activeAddress?: ActiveAddressSummary | null; activeVisitId?: string | null; activeProperty?: any }
      set({
        // Support legacy activeProperty key for backward compat
        activeAddress: parsed?.activeAddress ?? parsed?.activeProperty ?? null,
        activeVisitId: parsed?.activeVisitId ?? null,
      })
    } catch {
      // ignore
    }
  },
}))


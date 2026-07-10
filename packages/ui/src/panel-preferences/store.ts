import { createContext, createElement, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { PanelPreference } from './types'

export interface PanelState {
  size: number
  visible: boolean
}

export interface PanelPreferenceStore {
  panels: Record<string, PanelState>
  isLoaded: boolean
  initPanel: (panelId: string, state: PanelState) => void
  applyPanelPreference: (panelId: string, preference: PanelPreference, defaults: PanelState) => void
  setSize: (panelId: string, size: number) => void
  setVisible: (panelId: string, visible: boolean) => void
  setLoaded: (isLoaded: boolean) => void
}

export type PanelPreferenceStoreApi = StoreApi<PanelPreferenceStore>

export function createPanelPreferenceStore(): PanelPreferenceStoreApi {
  return createStore<PanelPreferenceStore>()((set) => ({
    panels: {},
    isLoaded: false,

    initPanel: (panelId, state) =>
      set((prev) => {
        if (prev.panels[panelId]) return prev
        return { panels: { ...prev.panels, [panelId]: state } }
      }),

    applyPanelPreference: (panelId, preference, defaults) =>
      set((prev) => {
        return {
          panels: {
            ...prev.panels,
            [panelId]: {
              size: preference.size ?? defaults.size,
              visible: preference.visible ?? defaults.visible,
            },
          },
        }
      }),

    setSize: (panelId, size) =>
      set((prev) => {
        const panel = prev.panels[panelId]
        if (!panel) return prev
        return {
          panels: { ...prev.panels, [panelId]: { ...panel, size } },
        }
      }),

    setVisible: (panelId, visible) =>
      set((prev) => {
        const panel = prev.panels[panelId]
        if (!panel) return prev
        return {
          panels: { ...prev.panels, [panelId]: { ...panel, visible } },
        }
      }),

    setLoaded: (isLoaded) => set({ isLoaded }),
  }))
}

const defaultPanelPreferenceStore = createPanelPreferenceStore()

export const usePanelPreferenceStore = Object.assign(function usePanelPreferenceStore<TValue>(
  selector: (state: PanelPreferenceStore) => TValue,
): TValue {
  return useStore(usePanelPreferenceStoreApi(), selector)
}, defaultPanelPreferenceStore)

const PanelPreferenceStoreContext = createContext<PanelPreferenceStoreApi | null>(null)

export function PanelPreferenceStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<PanelPreferenceStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = createPanelPreferenceStore()
  }

  return createElement(PanelPreferenceStoreContext.Provider, { value: storeRef.current }, children)
}

export function usePanelPreferenceStoreApi(): PanelPreferenceStoreApi {
  return useContext(PanelPreferenceStoreContext) ?? defaultPanelPreferenceStore
}

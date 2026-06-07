import { create } from 'zustand'

interface PanelState {
  size: number
  visible: boolean
}

interface PanelPreferenceStore {
  panels: Record<string, PanelState>
  isLoaded: boolean
  initPanel: (panelId: string, state: PanelState) => void
  applyPanelPreference: (
    panelId: string,
    preference: Pick<PanelState, 'size' | 'visible'>,
    defaults: Pick<PanelState, 'size' | 'visible'>,
  ) => void
  setSize: (panelId: string, size: number) => void
  setVisible: (panelId: string, visible: boolean) => void
  setLoaded: (isLoaded: boolean) => void
}

export const usePanelPreferenceStore = create<PanelPreferenceStore>()((set) => ({
  panels: {},
  isLoaded: false,

  initPanel: (panelId, state) =>
    set((prev) => {
      if (prev.panels[panelId]) return prev
      return { panels: { ...prev.panels, [panelId]: state } }
    }),

  applyPanelPreference: (panelId, preference, defaults) =>
    set((prev) => {
      const panel = prev.panels[panelId] ?? {
        size: defaults.size,
        visible: defaults.visible,
      }
      return {
        panels: {
          ...prev.panels,
          [panelId]: {
            ...panel,
            size: preference.size,
            visible: preference.visible,
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

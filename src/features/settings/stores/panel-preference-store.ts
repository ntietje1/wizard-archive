import { create } from 'zustand'

interface PanelState {
  size: number
  visible: boolean
  activeContentId: string | null
}

interface PanelPreferenceStore {
  panels: Record<string, PanelState>
  initPanel: (panelId: string, state: PanelState) => void
  setSize: (panelId: string, size: number) => void
  setVisible: (panelId: string, visible: boolean) => void
  setActiveContent: (panelId: string, contentId: string) => void
}

export const usePanelPreferenceStore = create<PanelPreferenceStore>()(
  (set) => ({
    panels: {},

    initPanel: (panelId, state) =>
      set((prev) => {
        if (prev.panels[panelId]) return prev
        return { panels: { ...prev.panels, [panelId]: state } }
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

    setActiveContent: (panelId, contentId) =>
      set((prev) => {
        const panel = prev.panels[panelId]
        if (!panel) return prev
        return {
          panels: {
            ...prev.panels,
            [panelId]: { ...panel, activeContentId: contentId },
          },
        }
      }),
  }),
)

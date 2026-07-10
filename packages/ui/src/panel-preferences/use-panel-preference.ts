import { useInitialPanelPreference } from '@wizard-archive/ui/panel-preferences/use-initial-panel-preference'
import { usePanelPreferenceStoreApi } from '@wizard-archive/ui/panel-preferences/store'
import { useStore } from 'zustand'

type PanelPreferenceState = {
  size: number
  visible: boolean
  setSize: (size: number) => void
  setVisible: (visible: boolean) => void
  isLoaded: boolean
}

export function usePanelPreference(
  panelId: string,
  defaults: { size: number; visible: boolean },
): PanelPreferenceState {
  const store = usePanelPreferenceStoreApi()
  const initPanel = useStore(store, (s) => s.initPanel)
  const panel = useStore(store, (s) => s.panels[panelId])
  const isLoaded = useStore(store, (s) => s.isLoaded)
  const initialPanel = useInitialPanelPreference(panelId)

  const ensurePanel = () => {
    initPanel(panelId, {
      size: initialPanel?.size ?? defaults.size,
      visible: initialPanel?.visible ?? defaults.visible,
    })
  }

  const size = panel?.size ?? initialPanel?.size ?? defaults.size
  const visible = panel?.visible ?? initialPanel?.visible ?? defaults.visible

  const setSize = (newSize: number) => {
    ensurePanel()
    store.getState().setSize(panelId, newSize)
  }

  const setVisible = (newVisible: boolean) => {
    ensurePanel()
    store.getState().setVisible(panelId, newVisible)
  }

  return {
    size,
    visible,
    setSize,
    setVisible,
    isLoaded,
  }
}

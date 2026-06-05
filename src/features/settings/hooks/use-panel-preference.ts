import { api } from 'convex/_generated/api'
import { useInitialPanelPreference } from '~/features/settings/hooks/use-initial-panel-preference'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'

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
  const setPanelPref = useAppMutation(api.userPreferences.mutations.setPanelPreference, {
    onError: (error) => {
      handleError(error, 'Failed to save panel preference')
    },
  })

  const store = usePanelPreferenceStore
  const initPanel = store((s) => s.initPanel)
  const panel = store((s) => s.panels[panelId])
  const isLoaded = store((s) => s.isLoaded)
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
    setPanelPref.mutate({ panelId, size: newSize })
  }

  const setVisible = (newVisible: boolean) => {
    ensurePanel()
    store.getState().setVisible(panelId, newVisible)
    setPanelPref.mutate({ panelId, visible: newVisible })
  }

  return {
    size,
    visible,
    setSize,
    setVisible,
    isLoaded,
  }
}

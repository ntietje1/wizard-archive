import { useEffect, useRef } from 'react'
import { api } from 'convex/_generated/api'
import type { PanelPreference } from 'convex/userPreferences/types'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { handleError } from '~/shared/utils/logger'

export type PanelPreferenceState = {
  size: number
  visible: boolean
  setSize: (size: number) => void
  setVisible: (visible: boolean) => void
  isLoaded: boolean
}

export function usePanelPreference(
  panelId: string,
  defaults: { size: number; visible: boolean },
  initial?: { size: number | null; visible: boolean | null },
): PanelPreferenceState {
  const prefsQuery = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
  )

  const setPanelPref = useAppMutation(
    api.userPreferences.mutations.setPanelPreference,
    {
      onError: (error) => {
        handleError(error, 'Failed to save panel preference')
      },
    },
  )

  const store = usePanelPreferenceStore
  const initPanel = store((s) => s.initPanel)
  const panel = store((s) => s.panels[panelId])

  const hasInitialized = useRef(false)

  if (!panel) {
    initPanel(panelId, {
      size: initial?.size ?? defaults.size,
      visible: initial?.visible ?? defaults.visible,
    })
  }

  const serverPanel: PanelPreference | undefined =
    prefsQuery.data?.panelPreferences?.[panelId]

  useEffect(() => {
    if (prefsQuery.isFetched && !hasInitialized.current) {
      hasInitialized.current = true
      const serverSize = serverPanel?.size ?? defaults.size
      const serverVisible = serverPanel?.visible ?? defaults.visible
      store.getState().setSize(panelId, serverSize)
      store.getState().setVisible(panelId, serverVisible)
    }
  }, [
    prefsQuery.isFetched,
    serverPanel?.size,
    serverPanel?.visible,
    defaults.size,
    defaults.visible,
    panelId,
    store,
  ])

  const size = panel?.size ?? defaults.size
  const visible = panel?.visible ?? defaults.visible

  const setSize = (newSize: number) => {
    store.getState().setSize(panelId, newSize)
    setPanelPref.mutate({ panelId, size: newSize })
  }

  const setVisible = (newVisible: boolean) => {
    store.getState().setVisible(panelId, newVisible)
    setPanelPref.mutate({ panelId, visible: newVisible })
  }

  return {
    size,
    visible,
    setSize,
    setVisible,
    isLoaded: prefsQuery.isSuccess,
  }
}

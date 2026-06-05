import { useEffect, useRef } from 'react'
import { api } from 'convex/_generated/api'
import type { PanelPreference } from 'shared/user-preferences/types'
import {
  RIGHT_SIDEBAR_DEFAULTS,
  RIGHT_SIDEBAR_PANEL_ID,
} from '~/features/editor/components/right-sidebar/constants'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
} from '~/features/sidebar/components/sidebar-toolbar/constants'
import { PanelPreferenceInitialProvider } from '~/features/settings/contexts/panel-preference-initial-provider'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

const PANEL_DEFINITIONS = [
  { panelId: LEFT_SIDEBAR_PANEL_ID, defaults: LEFT_SIDEBAR_DEFAULTS },
  { panelId: RIGHT_SIDEBAR_PANEL_ID, defaults: RIGHT_SIDEBAR_DEFAULTS },
] as const

export function CampaignPanelPreferencesController({
  children,
  initialPanelPreferences,
}: {
  children: React.ReactNode
  initialPanelPreferences: Record<string, PanelPreference> | null
}) {
  const prefsQuery = useAuthQuery(api.userPreferences.queries.getUserPreferences, {})
  const applyPanelPreference = usePanelPreferenceStore((state) => state.applyPanelPreference)
  const setLoaded = usePanelPreferenceStore((state) => state.setLoaded)
  const hasAppliedServerPreferencesRef = useRef(false)

  useEffect(() => {
    hasAppliedServerPreferencesRef.current = false
    setLoaded(false)
    for (const { defaults, panelId } of PANEL_DEFINITIONS) {
      const initial = initialPanelPreferences?.[panelId]
      applyPanelPreference(
        panelId,
        {
          size: initial?.size ?? defaults.size,
          visible: initial?.visible ?? defaults.visible,
        },
        defaults,
      )
    }
  }, [applyPanelPreference, initialPanelPreferences, setLoaded])

  useEffect(() => {
    if (!prefsQuery.isSuccess || hasAppliedServerPreferencesRef.current) return
    hasAppliedServerPreferencesRef.current = true

    for (const { defaults, panelId } of PANEL_DEFINITIONS) {
      const serverPanel = prefsQuery.data?.panelPreferences?.[panelId]
      applyPanelPreference(
        panelId,
        {
          size: serverPanel?.size ?? defaults.size,
          visible: serverPanel?.visible ?? defaults.visible,
        },
        defaults,
      )
    }
    setLoaded(true)
  }, [
    applyPanelPreference,
    initialPanelPreferences,
    prefsQuery.data?.panelPreferences,
    prefsQuery.isSuccess,
    setLoaded,
  ])

  return (
    <PanelPreferenceInitialProvider initialPanelPreferences={initialPanelPreferences}>
      {children}
    </PanelPreferenceInitialProvider>
  )
}

import { useContext } from 'react'
import { PanelPreferenceInitialContext } from '~/features/settings/contexts/panel-preference-initial-context'
import type { PanelPreference } from 'shared/user-preferences/types'

export function useInitialPanelPreference(panelId: string): PanelPreference | null {
  return useContext(PanelPreferenceInitialContext)?.[panelId] ?? null
}

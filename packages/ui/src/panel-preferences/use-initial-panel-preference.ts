import { useContext } from 'react'
import { PanelPreferenceInitialContext } from '@wizard-archive/ui/panel-preferences/initial-context'
import type { PanelPreference } from './types'

export function useInitialPanelPreference(panelId: string): PanelPreference | null {
  return useContext(PanelPreferenceInitialContext)?.[panelId] ?? null
}

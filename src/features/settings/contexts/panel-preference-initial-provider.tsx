import type { ReactNode } from 'react'
import { PanelPreferenceInitialContext } from './panel-preference-initial-context'
import type { PanelPreference } from 'shared/user-preferences/types'

export function PanelPreferenceInitialProvider({
  children,
  initialPanelPreferences,
}: {
  children: ReactNode
  initialPanelPreferences: Record<string, PanelPreference> | null
}) {
  return (
    <PanelPreferenceInitialContext.Provider value={initialPanelPreferences}>
      {children}
    </PanelPreferenceInitialContext.Provider>
  )
}

import type { ReactNode } from 'react'
import { PanelPreferenceInitialContext } from './initial-context'
import type { PanelPreference } from './types'

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

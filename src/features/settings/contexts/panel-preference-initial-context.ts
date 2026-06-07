import { createContext } from 'react'
import type { PanelPreference } from 'shared/user-preferences/types'

export const PanelPreferenceInitialContext = createContext<Record<string, PanelPreference> | null>(
  null,
)

import { createContext } from 'react'
import type { PanelPreference } from './types'

export const PanelPreferenceInitialContext = createContext<Record<string, PanelPreference> | null>(
  null,
)

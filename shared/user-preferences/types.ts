export type ThemePreference = 'light' | 'dark' | 'system'

export type PanelPreference = {
  size: number | null
  visible: boolean | null
}

export type UserPreferences = {
  theme: ThemePreference | null
  panelPreferences: Record<string, PanelPreference> | null
}

import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'

export type PanelPreference = {
  size: number | null
  visible: boolean | null
}

export type UserPreferences = ConvexValidatorFields<'userPreferences'> & {
  userId: Id<'userProfiles'>
  theme: 'light' | 'dark' | 'system' | null
  panelPreferences: Record<string, PanelPreference> | null
}

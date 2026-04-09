import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export type PanelPreference = {
  size: number | null
  visible: boolean | null
}

export type UserPreferences = CommonValidatorFields<'userPreferences'> & {
  userId: Id<'userProfiles'>
  theme: 'light' | 'dark' | 'system' | null
  panelPreferences: Record<string, PanelPreference> | null
}

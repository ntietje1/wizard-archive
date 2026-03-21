import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export type UserPreferences = CommonValidatorFields<'userPreferences'> & {
  userId: Id<'userProfiles'>
  sidebarWidth?: number
  isSidebarExpanded?: boolean
  theme?: 'light' | 'dark' | 'system'
}

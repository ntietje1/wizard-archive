import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export type UserPreferences = CommonValidatorFields<'userPreferences'> & {
  userId: Id<'userProfiles'>
  sidebarWidth: number | null
  isSidebarExpanded: boolean | null
  theme: 'light' | 'dark' | 'system' | null
}

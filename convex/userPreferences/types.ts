import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'
import type { ThemePreference } from '../../shared/user-preferences/types'

export type UserPreferences = ConvexValidatorFields<'userPreferences'> & {
  userId: Id<'userProfiles'>
  theme: ThemePreference | null
}

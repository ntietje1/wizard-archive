import type { UserIdentity } from 'convex/server'
import type { Id } from '../_generated/dataModel'

export type UserProfile = {
  _id: Id<'userProfiles'>
  _creationTime: number

  authUserId: string
  username: string
  email: string | null
  emailVerified: boolean | null
  name: string | null
  imageUrl: string | null // comes from OAuth if applicable
  imageStorageId: Id<'_storage'> | null // user uploaded value (has priority over imageUrl)
  twoFactorEnabled: boolean | null
}

export type AuthUser = { identity: UserIdentity; profile: UserProfile }

import type { UserIdentity } from 'convex/server'
import type { Id } from '../_generated/dataModel'

export type UserProfile = {
  _id: Id<'userProfiles'>
  _creationTime: number

  authUserId: string
  username: string
  email?: string
  name?: string
  imageUrl?: string // comes from OAuth if applicable
  imageStorageId?: Id<'_storage'> // user uploaded value (has priority over imageUrl)
}

export type AuthUser = { identity: UserIdentity; profile: UserProfile }

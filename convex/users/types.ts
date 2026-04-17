import type { UserIdentity } from 'convex/server'
import type { Id } from '../_generated/dataModel'
import type { Username } from './validation'

export type ProfileImage =
  | { type: 'external'; url: string }
  | { type: 'storage'; storageId: Id<'_storage'> }

export type UserProfileFromDb = {
  _id: Id<'userProfiles'>
  _creationTime: number

  authUserId: string
  username: Username
  email: string | null
  emailVerified: boolean | null
  name: string | null
  profileImage: ProfileImage | null
  twoFactorEnabled: boolean | null
}

export type UserProfile = Omit<UserProfileFromDb, 'profileImage'> & {
  imageUrl: string | null
}

export type AuthUser = { identity: UserIdentity; profile: UserProfileFromDb }

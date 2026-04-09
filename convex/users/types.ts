import type { UserIdentity } from 'convex/server'
import type { Id } from '../_generated/dataModel'

export type ProfileImage =
  | { type: 'external'; url: string }
  | { type: 'storage'; storageId: Id<'_storage'> }

export type UserProfileFromDb = {
  _id: Id<'userProfiles'>
  _creationTime: number

  authUserId: string
  username: string
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

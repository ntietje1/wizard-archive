import type { StorageId, UserProfileId } from '../common/ids'
import type { Username } from './validation'

export type ProfileImage =
  | { type: 'external'; url: string }
  | { type: 'storage'; storageId: StorageId }

export type UserProfileFromDb = {
  _id: UserProfileId
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

export type UserProfileSummary = Pick<UserProfile, 'name' | 'username' | 'imageUrl'>

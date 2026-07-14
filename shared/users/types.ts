import type { UserProfileId } from '../common/ids'
import type { AssetId } from '@wizard-archive/editor/resources/domain-id'
import type { Username } from './validation'

type ProfileImage = { type: 'external'; url: string } | { type: 'asset'; assetId: AssetId }

export type UserProfileRow = {
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

export type UserProfile = Omit<UserProfileRow, '_id' | '_creationTime' | 'profileImage'> & {
  id: UserProfileId
  createdAt: number
  imageUrl: string | null
}

export type UserProfileSummary = Pick<UserProfile, 'name' | 'username' | 'imageUrl'>

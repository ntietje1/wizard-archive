import type { UserProfileId } from '@wizard-archive/editor/resources/domain-id'
import type { Username } from './validation'

export type UserProfile = {
  id: UserProfileId
  createdAt: number
  username: Username
  email: string | null
  emailVerified: boolean | null
  name: string | null
  twoFactorEnabled: boolean | null
  imageUrl: string | null
}

export type UserProfileSummary = Pick<UserProfile, 'name' | 'username' | 'imageUrl'>

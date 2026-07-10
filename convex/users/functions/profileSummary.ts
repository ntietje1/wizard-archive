import type { UserProfile, UserProfileSummary } from '../../../shared/users/types'

export function toUserProfileSummary(profile: UserProfile): UserProfileSummary {
  return {
    name: profile.name,
    username: profile.username,
    imageUrl: profile.imageUrl,
  }
}

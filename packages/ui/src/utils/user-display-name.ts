type UserDisplayProfile = {
  name?: string | null
  username?: string | null
}

type CampaignMemberDisplaySource = {
  userProfile: UserDisplayProfile
}

export function getUserDisplayName(
  profile: UserDisplayProfile | null | undefined,
  fallback = 'Player',
) {
  if (profile?.name) return profile.name
  if (profile?.username) return `@${profile.username}`
  return fallback
}

export function getCampaignMemberDisplayName(
  member: CampaignMemberDisplaySource,
  fallback = 'Player',
) {
  return getUserDisplayName(member.userProfile, fallback)
}

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
  return profile?.name ? profile.name : profile?.username ? `@${profile.username}` : fallback
}

export function getCampaignMemberDisplayName(
  member: CampaignMemberDisplaySource,
  fallback = 'Player',
) {
  return getUserDisplayName(member.userProfile, fallback)
}

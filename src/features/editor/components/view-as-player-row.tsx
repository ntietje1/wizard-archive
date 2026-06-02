import type { CampaignMember } from 'shared/campaigns/types'
import { UserProfileImage } from '~/shared/components/user-profile-image'
import { getCampaignMemberDisplayName } from '~/shared/utils/user-display-name'

export function ViewAsPlayerRow({ member }: { member: CampaignMember }) {
  const profile = member.userProfile
  const displayName = getCampaignMemberDisplayName(member)

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <UserProfileImage
        imageUrl={profile.imageUrl}
        name={profile.name ?? profile.username}
        email={profile.email}
        size="sm"
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium" title={displayName}>
          {displayName}
        </span>
        {profile.username && (
          <span className="truncate text-xs text-muted-foreground" title={`@${profile.username}`}>
            @{profile.username}
          </span>
        )}
      </span>
    </span>
  )
}

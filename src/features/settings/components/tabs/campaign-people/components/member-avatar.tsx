import type { CampaignMember } from 'convex/campaigns/types'
import { UserProfileImage } from '~/shared/components/user-profile-image'

export function MemberAvatar({ member }: { member: CampaignMember }) {
  return (
    <UserProfileImage
      imageUrl={member.userProfile.imageUrl}
      name={member.userProfile.name}
      email={member.userProfile.email}
    />
  )
}

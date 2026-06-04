import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { UserProfileImage } from '~/shared/components/user-profile-image'

export function MemberAvatar({ member }: { member: CampaignMemberSummary }) {
  return <UserProfileImage imageUrl={member.userProfile.imageUrl} name={member.userProfile.name} />
}

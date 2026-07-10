import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'

export function MemberAvatar({ member }: { member: CampaignMemberSummary }) {
  return <UserProfileImage imageUrl={member.userProfile.imageUrl} name={member.userProfile.name} />
}

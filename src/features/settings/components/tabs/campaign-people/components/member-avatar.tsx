import type { CampaignMember } from 'convex/campaigns/types'
import { getInitials } from '~/shared/utils/get-initials'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'

export function MemberAvatar({ member }: { member: CampaignMember }) {
  return (
    <Avatar>
      {member.userProfile.imageUrl && (
        <AvatarImage
          src={member.userProfile.imageUrl}
          alt={member.userProfile.name ?? ''}
        />
      )}
      <AvatarFallback>
        {getInitials(member.userProfile.name, member.userProfile.email)}
      </AvatarFallback>
    </Avatar>
  )
}

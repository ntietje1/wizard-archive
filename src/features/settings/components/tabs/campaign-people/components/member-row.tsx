import { MemberAvatar } from './member-avatar'
import type { CampaignMember } from 'convex/campaigns/types'

export function MemberRow({
  member,
  badge,
  actions,
}: {
  member: CampaignMember
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <MemberAvatar member={member} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {member.userProfile.name ?? 'Unknown'}
          </span>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          @{member.userProfile.username}
          {member.userProfile.email && (
            <span className="before:content-['·'] before:mx-1">
              {member.userProfile.email}
            </span>
          )}
        </p>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}

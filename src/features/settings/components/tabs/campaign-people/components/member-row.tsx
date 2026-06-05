import { MemberAvatar } from './member-avatar'
import type { CampaignMemberSummary } from 'shared/campaigns/types'

export function MemberRow({
  member,
  badge,
  actions,
}: {
  member: CampaignMemberSummary
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  const username = member.userProfile.username

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
        {username && <p className="text-xs text-muted-foreground truncate">@{username}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

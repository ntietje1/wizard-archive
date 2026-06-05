import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { Avatar, AvatarFallback } from '~/features/shadcn/components/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { SHARE_MENU_OVERLAY_Z_INDEX } from '~/features/sharing/components/share-menu-layout'
import { UserProfileImage } from '~/shared/components/user-profile-image'
import { getUserDisplayName } from '~/shared/utils/user-display-name'

export function ShareMenuRowTooltip({
  text,
  className,
  testId,
  memberId,
  shareKind,
  children,
}: {
  text: string
  className?: string
  testId?: string
  memberId?: string
  shareKind?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={className}
            data-member-id={memberId}
            data-share-kind={shareKind}
            data-testid={testId}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="max-w-[220px]"
        positionerClassName={SHARE_MENU_OVERLAY_Z_INDEX}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export function ShareMenuPlayerIdentity({ member }: { member: CampaignMemberSummary }) {
  const profile = member.userProfile
  return (
    <>
      <UserProfileImage imageUrl={profile.imageUrl} name={profile.name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{getUserDisplayName(profile)}</span>
        {profile.username && (
          <span className="truncate text-xs text-muted-foreground">@{profile.username}</span>
        )}
      </div>
    </>
  )
}

export function ShareMenuAllPlayersRow({
  label,
  tooltipText,
  expanded,
  members,
  select,
  testId,
  onToggleExpand,
}: {
  label: string
  tooltipText: string
  expanded: boolean
  members: Array<CampaignMemberSummary>
  select: ReactNode
  testId?: string
  onToggleExpand: () => void
}) {
  const Chevron = expanded ? ChevronUp : ChevronDown
  const showStack = !expanded && members.length > 0
  const badgeCount = Math.min(members.length, 3) + (members.length > 3 ? 1 : 0)
  const iconAreaWidth = members.length > 0 ? 24 + (badgeCount - 1) * 16 : 24

  return (
    <ShareMenuRowTooltip
      text={tooltipText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
      testId={testId}
    >
      <button
        type="button"
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-80"
        onClick={onToggleExpand}
      >
        <div className="flex shrink-0 items-center justify-center" style={{ width: iconAreaWidth }}>
          {showStack ? (
            <ShareMenuAvatarStack members={members} />
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full bg-muted">
              <Users className="size-3.5 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="flex min-w-0 flex-1 items-center gap-1 text-left">
          <span className="truncate text-sm font-medium">{label}</span>
          <Chevron className="size-3.5 shrink-0 pt-0.5 text-muted-foreground" />
        </span>
      </button>
      {select}
    </ShareMenuRowTooltip>
  )
}

export function ShareMenuTreeItem({ isLast, children }: { isLast: boolean; children: ReactNode }) {
  return (
    <div className="relative flex items-center">
      <div className={`absolute left-0 top-0 w-px bg-border ${isLast ? 'h-1/2' : 'h-full'}`} />
      <div className="w-2 shrink-0 border-t border-border" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ShareMenuAvatarStack({ members }: { members: Array<CampaignMemberSummary> }) {
  return (
    <div className="flex items-center">
      {members.slice(0, 3).map((member, index) => (
        <UserProfileImage
          key={member._id}
          imageUrl={member.userProfile.imageUrl}
          name={member.userProfile.name}
          size="sm"
          className={`${index > 0 ? '-ml-2 ' : ''}ring-2 ring-background`}
        />
      ))}
      {members.length > 3 && (
        <Avatar size="sm" className="-ml-2 ring-2 ring-background">
          <AvatarFallback>+{members.length - 3}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

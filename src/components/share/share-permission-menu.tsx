import type { PermissionLevel } from 'convex/shares/types'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ShareItemWithPermission } from '~/hooks/useSidebarItemsShare'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/shadcn/ui/select'

const PERMISSION_OPTIONS: Array<{
  value: PermissionLevel
  label: string
}> = [
  { value: 'none', label: 'None' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'full_access', label: 'Full access' },
]

interface SharePermissionMenuProps {
  dmName: string
  isPending: boolean
  isMutating: boolean
  shareItems: Array<ShareItemWithPermission>
  allPlayersPermissionLevel: PermissionLevel
  onSetMemberPermission: (
    memberId: Id<'campaignMembers'>,
    level: PermissionLevel,
  ) => Promise<void>
  onSetAllPlayersPermission: (level: PermissionLevel) => Promise<void>
}

export function SharePermissionMenu({
  dmName,
  isPending,
  isMutating,
  shareItems,
  allPlayersPermissionLevel,
  onSetMemberPermission,
  onSetAllPlayersPermission,
}: SharePermissionMenuProps) {
  const isDisabled = isMutating || isPending

  if (isPending) {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-[280px]">
      <div className="text-sm font-medium px-1 pb-1">Share</div>

      {/* DM row - locked */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-sm truncate mr-2">{dmName || 'DM'}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Full access
        </span>
      </div>

      <div className="h-px bg-border my-0.5" />

      {/* All players bulk control */}
      <PermissionRow
        label="All players"
        value={allPlayersPermissionLevel}
        disabled={isDisabled}
        onChange={(level) => onSetAllPlayersPermission(level)}
      />

      {shareItems.length > 0 && <div className="h-px bg-border my-0.5" />}

      {/* Individual player rows */}
      {shareItems.map((shareItem) => (
        <PlayerPermissionRow
          key={shareItem.key}
          member={shareItem.member}
          permissionLevel={shareItem.permissionLevel}
          disabled={isDisabled}
          onChange={(level) =>
            onSetMemberPermission(shareItem.member._id, level)
          }
        />
      ))}

      {shareItems.length === 0 && (
        <div className="px-1 py-1">
          <div className="text-xs text-muted-foreground">
            No players in this campaign yet.
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerPermissionRow({
  member,
  permissionLevel,
  disabled,
  onChange,
}: {
  member: CampaignMember
  permissionLevel: PermissionLevel
  disabled: boolean
  onChange: (level: PermissionLevel) => void
}) {
  const profile = member.userProfile
  const displayText = profile.name
    ? profile.name
    : profile.username
      ? `@${profile.username}`
      : 'Player'

  return (
    <PermissionRow
      label={displayText}
      value={permissionLevel}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

function PermissionRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: PermissionLevel
  disabled: boolean
  onChange: (level: PermissionLevel) => void
}) {
  return (
    <div className="flex items-center justify-between px-1 py-0.5 gap-2">
      <span className="text-sm truncate flex-1">{label}</span>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as PermissionLevel)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {PERMISSION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

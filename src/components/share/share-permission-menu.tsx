import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { PermissionLevel } from 'convex/permissions/types'
import type { CampaignMember } from 'convex/campaigns/types'
import type { UserProfile } from 'convex/users/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ShareItemWithPermission } from '~/hooks/useSidebarItemsShare'
import { ChevronDown, ChevronUp, Users } from '~/lib/icons'
import usePersistedState from '~/hooks/usePersistedState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/shadcn/ui/select'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/components/shadcn/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/shadcn/ui/tooltip'
import { Switch } from '~/components/shadcn/ui/switch'
import { getInitials } from '~/shared/utils/get-initials'

type PermissionLevelOrDefault = PermissionLevel | 'default'

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  [PERMISSION_LEVEL.NONE]: 'None',
  [PERMISSION_LEVEL.VIEW]: 'View',
  [PERMISSION_LEVEL.EDIT]: 'Edit',
  [PERMISSION_LEVEL.FULL_ACCESS]: 'Full access',
}

function permissionLabel(level: PermissionLevel | null): string {
  return PERMISSION_LABELS[level ?? PERMISSION_LEVEL.NONE] ?? 'None'
}

function getDisplayName(profile: UserProfile): string {
  return profile.name || profile.username || 'Player'
}

function RowTooltip({
  text,
  className,
  children,
}: {
  text: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className={className} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[220px]">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

// --- Main component ---

interface SharePermissionMenuProps {
  dmUserProfile?: UserProfile
  isPending: boolean
  isMutating: boolean
  shareItems: Array<ShareItemWithPermission>
  allPlayersPermissionLevel: PermissionLevel | null
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  isFolder?: boolean
  inheritShares?: boolean
  onSetMemberPermission: (
    memberId: Id<'campaignMembers'>,
    level: PermissionLevel,
  ) => Promise<void>
  onClearMemberPermission: (memberId: Id<'campaignMembers'>) => Promise<void>
  onSetAllPlayersPermission: (level: PermissionLevel | null) => Promise<void>
  onSetInheritShares?: (enabled: boolean) => Promise<void>
}

export function SharePermissionMenu({
  dmUserProfile,
  isPending,
  isMutating,
  shareItems,
  allPlayersPermissionLevel,
  inheritedAllPermissionLevel,
  inheritedFromFolderName,
  isFolder,
  inheritShares,
  onSetMemberPermission,
  onClearMemberPermission,
  onSetAllPlayersPermission,
  onSetInheritShares,
}: SharePermissionMenuProps) {
  const [showPlayers, setShowPlayers] = usePersistedState(
    'share-show-players',
    false,
  )
  const isDisabled = isMutating || isPending

  if (isPending) {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const explicitShareItems = shareItems.filter((s) => s.hasExplicitShare)
  const inheritingShareItems = shareItems.filter((s) => !s.hasExplicitShare)

  function getPlayerInfoText(item: ShareItemWithPermission): string {
    const name = getDisplayName(item.member.userProfile)
    if (item.hasExplicitShare) {
      return `${name}'s access has been explicitly set`
    }
    if (item.inheritedFromFolderName && allPlayersPermissionLevel === null) {
      return `${name}'s access is based on ${item.inheritedFromFolderName}`
    }
    return `${name}'s access is based on the All Players permission level`
  }

  function handlePlayerChange(
    memberId: Id<'campaignMembers'>,
    value: PermissionLevelOrDefault,
  ) {
    if (value === 'default') {
      onClearMemberPermission(memberId)
    } else {
      onSetMemberPermission(memberId, value)
    }
  }

  const effectiveAllLabel =
    allPlayersPermissionLevel !== null
      ? permissionLabel(allPlayersPermissionLevel)
      : permissionLabel(inheritedAllPermissionLevel)

  const isInheritingAll =
    allPlayersPermissionLevel === null && inheritedAllPermissionLevel !== null

  return (
    <div className="flex flex-col gap-0.5 min-w-[300px]">
      <div className="text-sm font-medium px-1 pb-1">Share</div>
      <div className="h-px bg-border mb-0.5" />

      {dmUserProfile && <DmRow profile={dmUserProfile} />}

      {explicitShareItems.length > 0 && (
        <>
          <div className="h-px bg-border my-0.5" />
          {explicitShareItems.map((item) => (
            <PlayerRow
              key={item.key}
              shareItem={item}
              infoText={getPlayerInfoText(item)}
              disabled={isDisabled}
              onChange={(val) => handlePlayerChange(item.member._id, val)}
            />
          ))}
        </>
      )}

      <div className="h-px bg-border my-0.5" />

      <AllPlayersRow
        selectValue={allPlayersPermissionLevel ?? 'default'}
        selectLabel={effectiveAllLabel}
        inheritedLevel={inheritedAllPermissionLevel}
        disabled={isDisabled}
        expanded={showPlayers}
        label={
          explicitShareItems.length === 0 ? 'All Players' : 'Other Players'
        }
        inheritingMembers={inheritingShareItems.map((s) => s.member)}
        isInheriting={isInheritingAll}
        inheritedFromFolderName={inheritedFromFolderName}
        onToggleExpand={() => setShowPlayers((prev) => !prev)}
        onChange={(val) =>
          onSetAllPlayersPermission(val === 'default' ? null : val)
        }
      />

      {showPlayers && (
        <ExpandedPlayerList
          inheritingItems={inheritingShareItems}
          hasAnyPlayers={shareItems.length > 0}
          getInfoText={getPlayerInfoText}
          disabled={isDisabled}
          onPlayerChange={handlePlayerChange}
        />
      )}

      {isFolder && onSetInheritShares && (
        <>
          <div className="h-px bg-border my-0.5" />
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex items-center justify-between px-1 py-1 gap-2" />
              }
            >
              <span className="text-sm truncate flex-1">
                Copy permissions to new items
              </span>
              <Switch
                size="sm"
                checked={inheritShares ?? false}
                disabled={isDisabled}
                onCheckedChange={onSetInheritShares}
              />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px]">
              All items and folders inside this folder will share the same
              permissions
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  )
}

// --- Row components ---

function DmRow({ profile }: { profile: UserProfile }) {
  return (
    <RowTooltip
      text="DMs always have full access"
      className="flex items-center gap-2.5 px-1 py-1.5"
    >
      <Avatar size="sm">
        {profile.imageUrl && (
          <AvatarImage src={profile.imageUrl} alt={getDisplayName(profile)} />
        )}
        <AvatarFallback>
          {getInitials(profile.name, profile.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col flex-1 min-w-0 select-none">
        <span className="text-sm font-medium truncate">
          {getDisplayName(profile)}
        </span>
        {profile.username && (
          <span className="text-xs text-muted-foreground truncate">
            @{profile.username}
          </span>
        )}
      </div>
      <Select value="full_access" disabled>
        <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
          <SelectValue>Full access</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full_access">Full access</SelectItem>
        </SelectContent>
      </Select>
    </RowTooltip>
  )
}

function PlayerRow({
  shareItem,
  infoText,
  disabled,
  onChange,
}: {
  shareItem: ShareItemWithPermission
  infoText: string
  disabled: boolean
  onChange: (value: PermissionLevelOrDefault) => void
}) {
  const {
    member,
    hasExplicitShare,
    permissionLevel,
    inheritedPermissionLevel,
  } = shareItem
  const profile = member.userProfile
  const selectValue: PermissionLevelOrDefault = hasExplicitShare
    ? permissionLevel
    : 'default'

  return (
    <RowTooltip
      text={infoText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
    >
      <Avatar size="sm">
        {profile.imageUrl && (
          <AvatarImage src={profile.imageUrl} alt={getDisplayName(profile)} />
        )}
        <AvatarFallback>
          {getInitials(profile.name, profile.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm font-medium truncate">
          {getDisplayName(profile)}
        </span>
        {profile.username && (
          <span className="text-xs text-muted-foreground truncate">
            @{profile.username}
          </span>
        )}
      </div>
      <Select
        value={selectValue}
        onValueChange={(val) => {
          if (val !== null) onChange(val)
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
          <SelectValue>{permissionLabel(permissionLevel)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="p-1" align="end" alignItemWithTrigger={false}>
          {!hasExplicitShare && (
            <SelectItem value="default">
              Default ({permissionLabel(inheritedPermissionLevel)})
            </SelectItem>
          )}
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="view">View</SelectItem>
          <SelectItem value="edit">Edit</SelectItem>
          <SelectItem value="full_access">Full access</SelectItem>
          {hasExplicitShare && (
            <>
              <SelectSeparator />
              <SelectItem value="default" className="text-destructive">
                Remove
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
    </RowTooltip>
  )
}

function AllPlayersRow({
  selectValue,
  selectLabel,
  inheritedLevel,
  disabled,
  expanded,
  label,
  inheritingMembers,
  isInheriting,
  inheritedFromFolderName,
  onToggleExpand,
  onChange,
}: {
  selectValue: PermissionLevelOrDefault
  selectLabel: string
  inheritedLevel: PermissionLevel | null
  disabled: boolean
  expanded: boolean
  label: string
  inheritingMembers: Array<CampaignMember>
  isInheriting: boolean
  inheritedFromFolderName: string | null
  onToggleExpand: () => void
  onChange: (value: PermissionLevelOrDefault) => void
}) {
  const Chevron = expanded ? ChevronUp : ChevronDown
  const showStack = !expanded && inheritingMembers.length > 0
  const badgeCount =
    Math.min(inheritingMembers.length, 3) +
    (inheritingMembers.length > 3 ? 1 : 0)
  const iconAreaWidth =
    inheritingMembers.length > 0 ? 24 + (badgeCount - 1) * 16 : 24

  let infoText = 'This is the default permission level for all players.'
  if (isInheriting && inheritedFromFolderName) {
    infoText += ` Access is based on ${inheritedFromFolderName}.`
  }

  const options: Array<{ value: PermissionLevelOrDefault; label: string }> = [
    { value: 'default', label: `Default (${permissionLabel(inheritedLevel)})` },
    { value: PERMISSION_LEVEL.NONE, label: 'None' },
    { value: PERMISSION_LEVEL.VIEW, label: 'View' },
    { value: PERMISSION_LEVEL.EDIT, label: 'Edit' },
    { value: PERMISSION_LEVEL.FULL_ACCESS, label: 'Full access' },
  ]

  return (
    <RowTooltip
      text={infoText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
    >
      <button
        type="button"
        className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
        onClick={onToggleExpand}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: iconAreaWidth }}
        >
          {showStack ? (
            <AvatarStack members={inheritingMembers} />
          ) : (
            <div className="flex items-center justify-center size-6 rounded-lg bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="text-sm font-medium truncate flex items-center gap-1">
          {label}
          <Chevron className="h-3.5 w-3.5 text-muted-foreground shrink-0 pt-0.5" />
        </span>
      </button>
      <Select
        value={selectValue}
        onValueChange={(val) => {
          if (val !== null) onChange(val)
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
          <SelectValue>{selectLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent className="p-1" align="end" alignItemWithTrigger={false}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </RowTooltip>
  )
}

function AvatarStack({ members }: { members: Array<CampaignMember> }) {
  return (
    <div className="flex items-center -space-x-2">
      {members.slice(0, 3).map((member) => (
        <Avatar key={member._id} size="sm" className="ring-2 ring-background">
          {member.userProfile.imageUrl && (
            <AvatarImage
              src={member.userProfile.imageUrl}
              alt={getDisplayName(member.userProfile)}
            />
          )}
          <AvatarFallback>
            {getInitials(member.userProfile.name, member.userProfile.email)}
          </AvatarFallback>
        </Avatar>
      ))}
      {members.length > 3 && (
        <Avatar size="sm" className="ring-2 ring-background">
          <AvatarFallback>+{members.length - 3}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// --- Expanded player list ---

function ExpandedPlayerList({
  inheritingItems,
  hasAnyPlayers,
  getInfoText,
  disabled,
  onPlayerChange,
}: {
  inheritingItems: Array<ShareItemWithPermission>
  hasAnyPlayers: boolean
  getInfoText: (item: ShareItemWithPermission) => string
  disabled: boolean
  onPlayerChange: (
    memberId: Id<'campaignMembers'>,
    value: PermissionLevelOrDefault,
  ) => void
}) {
  if (inheritingItems.length > 0) {
    return (
      <div className="ml-4">
        {inheritingItems.map((item, index) => (
          <TreeItem
            key={item.key}
            isLast={index === inheritingItems.length - 1}
          >
            <PlayerRow
              shareItem={item}
              infoText={getInfoText(item)}
              disabled={disabled}
              onChange={(val) => onPlayerChange(item.member._id, val)}
            />
          </TreeItem>
        ))}
      </div>
    )
  }

  if (!hasAnyPlayers) {
    return (
      <div className="px-1 py-1">
        <div className="text-xs text-muted-foreground">
          No players in this campaign yet.
        </div>
      </div>
    )
  }

  return (
    <div className="ml-4">
      <TreeItem isLast>
        <div className="pl-1">
          <div className="text-xs text-muted-foreground py-1">
            All players have explicit permissions set.
          </div>
        </div>
      </TreeItem>
    </div>
  )
}

function TreeItem({
  isLast,
  children,
}: {
  isLast: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative flex items-center">
      <div
        className={`absolute left-0 w-px bg-border ${isLast ? 'top-0 h-1/2' : 'top-0 h-full'}`}
      />
      <div className="w-2 border-t border-border shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

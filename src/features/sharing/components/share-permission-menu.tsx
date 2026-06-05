import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { ReactNode } from 'react'
import type { PermissionLevel } from 'shared/permissions/types'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type {
  NullableAggregatePermissionLevel,
  ShareItemWithPermission,
} from '~/features/sharing/hooks/useSidebarItemsShare'
import usePersistedState from '~/shared/hooks/usePersistedState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/features/shadcn/components/select'
import { Switch } from '~/features/shadcn/components/switch'
import {
  SHARE_MENU_OVERLAY_Z_INDEX,
  SHARE_MENU_WIDTH_CLASS,
} from '~/features/sharing/components/share-menu-layout'
import {
  ShareMenuAllPlayersRow,
  ShareMenuPlayerIdentity,
  ShareMenuRowTooltip,
  ShareMenuTreeItem,
} from '~/features/sharing/components/share-menu-row-parts'
import { getUserDisplayName } from '~/shared/utils/user-display-name'

type PermissionLevelOrDefault = PermissionLevel | 'default'
type PermissionSelectValue = PermissionLevelOrDefault | 'mixed'
type ShareMemberId = ShareItemWithPermission['member']['_id']

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  [PERMISSION_LEVEL.NONE]: 'None',
  [PERMISSION_LEVEL.VIEW]: 'View',
  [PERMISSION_LEVEL.EDIT]: 'Edit',
  [PERMISSION_LEVEL.FULL_ACCESS]: 'Full access',
}

function permissionLabel(level: NullableAggregatePermissionLevel): string {
  if (level === 'mixed') return 'Mixed'
  return PERMISSION_LABELS[level ?? PERMISSION_LEVEL.NONE] ?? 'None'
}

// --- Main component ---

interface SharePermissionMenuProps {
  title?: ReactNode
  isPending: boolean
  isMutating: boolean
  shareItems: Array<ShareItemWithPermission>
  allPlayersPermissionLevel: NullableAggregatePermissionLevel
  inheritedAllPermissionLevel: NullableAggregatePermissionLevel
  inheritedFromFolderName: string | null
  isFolder?: boolean
  inheritShares?: boolean
  onSetMemberPermission: (memberId: ShareMemberId, level: PermissionLevel) => Promise<void>
  onClearMemberPermission: (memberId: ShareMemberId) => Promise<void>
  onSetAllPlayersPermission: (level: PermissionLevel | null) => Promise<void>
  onSetInheritShares?: (enabled: boolean) => Promise<void>
}

export function SharePermissionMenu({
  title = 'Share',
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
  const [showPlayers, setShowPlayers] = usePersistedState('share-show-players', false)
  const isDisabled = isMutating || isPending

  if (isPending) {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Loading&hellip;</div>
      </div>
    )
  }

  const explicitShareItems = shareItems.filter((s) => s.hasExplicitShare)
  const inheritingShareItems = shareItems.filter((s) => !s.hasExplicitShare)

  function getPlayerInfoText(item: ShareItemWithPermission): string {
    const name = getUserDisplayName(item.member.userProfile)
    if (item.permissionLevel === 'mixed' || item.inheritedPermissionLevel === 'mixed') {
      return `${name}'s access differs across the selected items`
    }
    if (item.hasExplicitShare) {
      return `${name}'s access has been explicitly set`
    }
    if (item.inheritedFromFolderName && allPlayersPermissionLevel === null) {
      return `${name}'s access is based on ${item.inheritedFromFolderName}`
    }
    return `${name}'s access is based on the All Players permission level`
  }

  function handlePlayerChange(memberId: ShareMemberId, value: PermissionLevelOrDefault) {
    if (value === 'default') {
      void onClearMemberPermission(memberId)
    } else {
      void onSetMemberPermission(memberId, value)
    }
  }

  const effectiveAllLabel =
    allPlayersPermissionLevel !== null
      ? permissionLabel(allPlayersPermissionLevel)
      : permissionLabel(inheritedAllPermissionLevel)

  const isInheritingAll = allPlayersPermissionLevel === null && inheritedAllPermissionLevel !== null

  return (
    <div className={`flex flex-col gap-0.5 ${SHARE_MENU_WIDTH_CLASS}`}>
      <div className="text-sm font-medium px-1 pb-1">{title}</div>
      <div className="h-px bg-border mb-0.5" />

      {explicitShareItems.length > 0 && (
        <div>
          {explicitShareItems.map((item) => (
            <PlayerRow
              key={item.key}
              shareItem={item}
              infoText={getPlayerInfoText(item)}
              disabled={isDisabled}
              onChange={(val) => handlePlayerChange(item.member._id, val)}
            />
          ))}
        </div>
      )}

      {explicitShareItems.length > 0 && <div className="h-px bg-border my-0.5" />}

      <AllPlayersRow
        selectValue={allPlayersPermissionLevel ?? 'default'}
        selectLabel={effectiveAllLabel}
        inheritedLevel={inheritedAllPermissionLevel}
        disabled={isDisabled}
        expanded={showPlayers}
        label={explicitShareItems.length === 0 ? 'All Players' : 'Other Players'}
        inheritingMembers={inheritingShareItems.map((s) => s.member)}
        isInheriting={isInheritingAll}
        inheritedFromFolderName={inheritedFromFolderName}
        onToggleExpand={() => setShowPlayers((prev) => !prev)}
        onChange={(val) => onSetAllPlayersPermission(val === 'default' ? null : val)}
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
          <ShareMenuRowTooltip
            text="All items and folders inside this folder will share the same permissions"
            className="flex items-center justify-between p-1 gap-2"
          >
            <span className="text-sm truncate flex-1">Copy permissions to new items</span>
            <Switch
              size="sm"
              checked={inheritShares ?? false}
              disabled={isDisabled}
              onCheckedChange={onSetInheritShares}
            />
          </ShareMenuRowTooltip>
        </>
      )}
    </div>
  )
}

// --- Row components ---

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
  const { member, hasExplicitShare, permissionLevel, inheritedPermissionLevel } = shareItem
  const selectValue: PermissionSelectValue = hasExplicitShare ? permissionLevel : 'default'

  return (
    <ShareMenuRowTooltip
      text={infoText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
    >
      <ShareMenuPlayerIdentity member={member} />
      <Select
        value={selectValue}
        onValueChange={(val) => {
          if (val !== null && val !== 'mixed') onChange(val)
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
          <SelectValue>{permissionLabel(permissionLevel)}</SelectValue>
        </SelectTrigger>
        <SelectContent
          className="p-1"
          align="end"
          alignItemWithTrigger={false}
          data-share-menu-overlay="true"
          onPointerDown={(event) => event.stopPropagation()}
          positionerClassName={SHARE_MENU_OVERLAY_Z_INDEX}
        >
          {selectValue === 'mixed' && (
            <>
              <SelectItem value="mixed" disabled>
                Mixed
              </SelectItem>
              <SelectSeparator />
            </>
          )}
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
    </ShareMenuRowTooltip>
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
  selectValue: PermissionSelectValue
  selectLabel: string
  inheritedLevel: NullableAggregatePermissionLevel
  disabled: boolean
  expanded: boolean
  label: string
  inheritingMembers: Array<CampaignMemberSummary>
  isInheriting: boolean
  inheritedFromFolderName: string | null
  onToggleExpand: () => void
  onChange: (value: PermissionLevelOrDefault) => void
}) {
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
    <ShareMenuAllPlayersRow
      label={label}
      tooltipText={infoText}
      expanded={expanded}
      members={inheritingMembers}
      testId="share-all-players-row"
      onToggleExpand={onToggleExpand}
      select={
        <Select
          value={selectValue}
          onValueChange={(val) => {
            if (val !== null && val !== 'mixed') onChange(val)
          }}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
            <SelectValue>{selectLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent
            className="p-1"
            align="end"
            alignItemWithTrigger={false}
            data-share-menu-overlay="true"
            onPointerDown={(event) => event.stopPropagation()}
            positionerClassName={SHARE_MENU_OVERLAY_Z_INDEX}
          >
            {selectValue === 'mixed' && (
              <>
                <SelectItem value="mixed" disabled>
                  Mixed
                </SelectItem>
                <SelectSeparator />
              </>
            )}
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
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
  onPlayerChange: (memberId: ShareMemberId, value: PermissionLevelOrDefault) => void
}) {
  if (inheritingItems.length > 0) {
    return (
      <div className="ml-4">
        {inheritingItems.map((item, index) => (
          <ShareMenuTreeItem key={item.key} isLast={index === inheritingItems.length - 1}>
            <PlayerRow
              shareItem={item}
              infoText={getInfoText(item)}
              disabled={disabled}
              onChange={(val) => onPlayerChange(item.member._id, val)}
            />
          </ShareMenuTreeItem>
        ))}
      </div>
    )
  }

  if (!hasAnyPlayers) {
    return (
      <div className="p-1">
        <div className="text-xs text-muted-foreground">No players in this campaign yet.</div>
      </div>
    )
  }

  return (
    <div className="ml-4">
      <ShareMenuTreeItem isLast>
        <div className="pl-1">
          <div className="text-xs text-muted-foreground py-1">
            All players have explicit permissions set.
          </div>
        </div>
      </ShareMenuTreeItem>
    </div>
  )
}

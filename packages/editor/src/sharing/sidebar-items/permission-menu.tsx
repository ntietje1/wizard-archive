import type { ReactNode } from 'react'
import type {
  EditorPermissionLevel,
  EditorShareParticipant,
  ResourceShareState,
} from '../contracts'
import { EDITOR_PERMISSION_LEVEL } from '../contracts'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@wizard-archive/ui/shadcn/components/select'
import { Switch } from '@wizard-archive/ui/shadcn/components/switch'
import { SHARE_MENU_OVERLAY_Z_INDEX, SHARE_MENU_WIDTH_CLASS } from '../menu/layout'
import {
  ShareMenuAllPlayersRow,
  ShareMenuPlayerIdentity,
  ShareMenuRowTooltip,
  ShareMenuTreeItem,
} from '../menu/row'

type PermissionLevelOrDefault = EditorPermissionLevel | 'default'
type PermissionSelectValue = PermissionLevelOrDefault | 'mixed'
type ShareItemWithPermission = ResourceShareState['shareItems'][number]
type NullableAggregatePermissionLevel = ResourceShareState['defaultPermissionLevel']
type ShareParticipantId = ShareItemWithPermission['participant']['id']
type ShareMenuStatus = 'ready' | 'pending' | 'mutating' | 'unavailable' | 'incomplete' | 'failed'

const PERMISSION_LABELS: Record<EditorPermissionLevel, string> = {
  [EDITOR_PERMISSION_LEVEL.NONE]: 'None',
  [EDITOR_PERMISSION_LEVEL.VIEW]: 'View',
  [EDITOR_PERMISSION_LEVEL.EDIT]: 'Edit',
  [EDITOR_PERMISSION_LEVEL.FULL_ACCESS]: 'Full access',
}

const PERMISSION_OPTIONS: Array<{ value: EditorPermissionLevel; label: string }> = [
  { value: EDITOR_PERMISSION_LEVEL.NONE, label: PERMISSION_LABELS[EDITOR_PERMISSION_LEVEL.NONE] },
  { value: EDITOR_PERMISSION_LEVEL.VIEW, label: PERMISSION_LABELS[EDITOR_PERMISSION_LEVEL.VIEW] },
  { value: EDITOR_PERMISSION_LEVEL.EDIT, label: PERMISSION_LABELS[EDITOR_PERMISSION_LEVEL.EDIT] },
  {
    value: EDITOR_PERMISSION_LEVEL.FULL_ACCESS,
    label: PERMISSION_LABELS[EDITOR_PERMISSION_LEVEL.FULL_ACCESS],
  },
]

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function permissionLabel(level: NullableAggregatePermissionLevel): string {
  if (level === 'mixed') return 'Mixed'
  return PERMISSION_LABELS[level ?? EDITOR_PERMISSION_LEVEL.NONE] ?? 'None'
}

// --- Main component ---

interface SharePermissionMenuProps {
  title?: ReactNode
  status: ShareMenuStatus
  shareItems: Array<ShareItemWithPermission>
  defaultPermissionLevel: NullableAggregatePermissionLevel
  inheritedAllPermissionLevel: NullableAggregatePermissionLevel
  inheritedFromFolderName: string | null
  folder?: {
    inheritShares: boolean
    onSetInheritShares: (enabled: boolean) => Promise<unknown>
  }
  onSetParticipantPermission?: (
    participantId: ShareParticipantId,
    level: EditorPermissionLevel,
  ) => Promise<unknown>
  onClearParticipantPermission?: (participantId: ShareParticipantId) => Promise<unknown>
  onSetDefaultPermission?: (level: EditorPermissionLevel | null) => Promise<unknown>
}

export function SharePermissionMenu({
  title = 'Share',
  status,
  shareItems,
  defaultPermissionLevel,
  inheritedAllPermissionLevel,
  inheritedFromFolderName,
  folder,
  onSetParticipantPermission,
  onClearParticipantPermission,
  onSetDefaultPermission,
}: SharePermissionMenuProps) {
  const [showPlayers, setShowPlayers] = usePersistedState('share-show-players', false, parseBoolean)
  const isDisabled = status !== 'ready'

  if (status === 'pending') {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Loading&hellip;</div>
      </div>
    )
  }

  if (status === 'incomplete') {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">
          Sharing settings are unavailable for this selection.
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Sharing settings could not be loaded.</div>
      </div>
    )
  }

  const explicitShareItems = shareItems.filter((s) => s.hasExplicitShare)
  const inheritingShareItems = shareItems.filter((s) => !s.hasExplicitShare)

  function getPlayerInfoText(item: ShareItemWithPermission): string {
    const name = item.participant.displayName
    if (item.permissionLevel === 'mixed' || item.inheritedPermissionLevel === 'mixed') {
      return `${name}'s access differs across the selected items`
    }
    if (item.hasExplicitShare) {
      return `${name}'s access has been explicitly set`
    }
    if (item.inheritedFromFolderName && defaultPermissionLevel === null) {
      return `${name}'s access is based on ${item.inheritedFromFolderName}`
    }
    return `${name}'s access is based on the All Players permission level`
  }

  function handlePlayerChange(participantId: ShareParticipantId, value: PermissionLevelOrDefault) {
    if (value === 'default') {
      void onClearParticipantPermission?.(participantId)
    } else {
      void onSetParticipantPermission?.(participantId, value)
    }
  }

  const effectiveAllLabel =
    defaultPermissionLevel !== null
      ? permissionLabel(defaultPermissionLevel)
      : permissionLabel(inheritedAllPermissionLevel)

  const isInheritingAll = defaultPermissionLevel === null && inheritedAllPermissionLevel !== null

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
              onChange={(val) => handlePlayerChange(item.participant.id, val)}
            />
          ))}
        </div>
      )}

      {explicitShareItems.length > 0 && <div className="h-px bg-border my-0.5" />}

      <AllPlayersRow
        selectValue={defaultPermissionLevel ?? 'default'}
        selectLabel={effectiveAllLabel}
        inheritedLevel={inheritedAllPermissionLevel}
        disabled={isDisabled}
        expanded={showPlayers}
        label={explicitShareItems.length === 0 ? 'All Players' : 'Other Players'}
        inheritingMembers={inheritingShareItems.map((s) => s.participant)}
        isInheriting={isInheritingAll}
        inheritedFromFolderName={inheritedFromFolderName}
        onToggleExpand={() => setShowPlayers((prev) => !prev)}
        onChange={(val) => {
          void onSetDefaultPermission?.(val === 'default' ? null : val)
        }}
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

      {folder && (
        <>
          <div className="h-px bg-border my-0.5" />
          <ShareMenuRowTooltip
            text="All items and folders inside this folder will share the same permissions"
            className="flex items-center justify-between p-1 gap-2"
          >
            <span className="text-sm truncate flex-1">Copy permissions to new items</span>
            <Switch
              size="sm"
              checked={folder.inheritShares}
              disabled={isDisabled}
              onCheckedChange={folder.onSetInheritShares}
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
  const { participant, hasExplicitShare, permissionLevel, inheritedPermissionLevel } = shareItem
  const selectValue: PermissionSelectValue = hasExplicitShare ? permissionLevel : 'default'

  return (
    <ShareMenuRowTooltip
      text={infoText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
    >
      <ShareMenuPlayerIdentity member={participant} />
      <PermissionSelect
        value={selectValue}
        label={permissionLabel(permissionLevel)}
        defaultLabel={
          hasExplicitShare ? null : `Default (${permissionLabel(inheritedPermissionLevel)})`
        }
        removeLabel={hasExplicitShare ? 'Remove' : null}
        disabled={disabled}
        onChange={onChange}
      />
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
  inheritingMembers: Array<EditorShareParticipant>
  isInheriting: boolean
  inheritedFromFolderName: string | null
  onToggleExpand: () => void
  onChange: (value: PermissionLevelOrDefault) => void
}) {
  let infoText = 'This is the default permission level for all players.'
  if (isInheriting && inheritedFromFolderName) {
    infoText += ` Access is based on ${inheritedFromFolderName}.`
  }

  return (
    <ShareMenuAllPlayersRow
      label={label}
      tooltipText={infoText}
      expanded={expanded}
      members={inheritingMembers}
      testId="share-all-players-row"
      onToggleExpand={onToggleExpand}
      select={
        <PermissionSelect
          value={selectValue}
          label={selectLabel}
          defaultLabel={`Default (${permissionLabel(inheritedLevel)})`}
          removeLabel={null}
          disabled={disabled}
          onChange={onChange}
        />
      }
    />
  )
}

function PermissionSelect({
  value,
  label,
  defaultLabel,
  removeLabel,
  disabled,
  onChange,
}: {
  value: PermissionSelectValue
  label: string
  defaultLabel: string | null
  removeLabel: string | null
  disabled: boolean
  onChange: (value: PermissionLevelOrDefault) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null && nextValue !== 'mixed') onChange(nextValue)
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="min-w-[110px] h-7 text-xs">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent
        className="p-1"
        align="end"
        alignItemWithTrigger={false}
        data-share-menu-overlay="true"
        data-item-surface-floating-command="true"
        onPointerDown={(event) => event.stopPropagation()}
        positionerClassName={SHARE_MENU_OVERLAY_Z_INDEX}
      >
        {value === 'mixed' && (
          <>
            <SelectItem value="mixed" disabled>
              Mixed
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {defaultLabel && <SelectItem value="default">{defaultLabel}</SelectItem>}
        {PERMISSION_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
        {removeLabel && (
          <>
            <SelectSeparator />
            <SelectItem value="default" className="text-destructive">
              {removeLabel}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
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
  onPlayerChange: (participantId: ShareParticipantId, value: PermissionLevelOrDefault) => void
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
              onChange={(val) => onPlayerChange(item.participant.id, val)}
            />
          </ShareMenuTreeItem>
        ))}
      </div>
    )
  }

  if (!hasAnyPlayers) {
    return (
      <div className="p-1">
        <div className="text-xs text-muted-foreground">No players in this workspace yet.</div>
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

import { Lock } from 'lucide-react'
import { useState } from 'react'
import type { BlocksShareState, EditorShareParticipant } from '../contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@wizard-archive/ui/shadcn/components/select'
import { SHARE_MENU_OVERLAY_Z_INDEX, SHARE_MENU_WIDTH_CLASS } from '../menu/layout'
import {
  ShareMenuAllPlayersRow,
  ShareMenuPlayerIdentity,
  ShareMenuRowTooltip,
  ShareMenuTreeItem,
} from '../menu/row'

type ReadyBlocksShareState = Extract<BlocksShareState, { status: 'ready' }>
type BlockShareItem = ReadyBlocksShareState['shareItems'][number]
type ShareParticipantId = BlockShareItem['participant']['id']
type AggregateBlockVisibilitySelectValue = ReadyBlocksShareState['defaultPermissionLevel']
type BlockAllPlayersPermissionValue = Parameters<ReadyBlocksShareState['setDefaultPermission']>[0]
type BlockShareItemPermissionValue = BlockShareItem['permissionLevel']
type BlockVisibilitySelectValue = Parameters<ReadyBlocksShareState['setParticipantPermission']>[1]

function visibilityLabel(value: BlockShareItemPermissionValue): string {
  switch (value) {
    case 'default':
      return 'Default'
    case 'hidden':
      return 'Hidden'
    case 'visible':
      return 'Visible'
    case 'mixed':
      return 'Mixed'
  }
}

interface BlockSharePermissionMenuProps {
  title?: string
  isMutating: boolean
  shareItems: Array<BlockShareItem>
  defaultPermissionLevel: AggregateBlockVisibilitySelectValue
  onSetAllPlayersPermission: (value: BlockAllPlayersPermissionValue) => Promise<unknown>
  onSetMemberPermission: (
    participantId: ShareParticipantId,
    value: BlockVisibilitySelectValue,
  ) => Promise<unknown>
}

export function BlockSharePermissionMenu({
  title = 'Share',
  isMutating,
  shareItems,
  defaultPermissionLevel,
  onSetAllPlayersPermission,
  onSetMemberPermission,
}: BlockSharePermissionMenuProps) {
  const [showPlayers, setShowPlayers] = useState(true)
  const disabled = isMutating

  const controllableItems = shareItems.filter((item) => item.kind === 'controllable')
  const explicitItems = controllableItems.filter((item) => item.hasExplicitShare)
  const defaultItems = controllableItems.filter((item) => !item.hasExplicitShare)
  const lockedItems = shareItems.filter((item) => item.kind === 'locked_visible')

  return (
    <div
      className={`flex flex-col gap-0.5 ${SHARE_MENU_WIDTH_CLASS}`}
      data-testid="block-share-menu"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="px-1 pb-1 text-sm font-medium">{title}</div>
      <div className="mb-0.5 h-px bg-border" />

      {explicitItems.map((item) => (
        <PlayerRow
          key={item.key}
          shareItem={item}
          defaultValue={defaultPermissionLevel}
          disabled={disabled}
          onChange={(value) => onSetMemberPermission(item.participant.id, value)}
        />
      ))}

      {explicitItems.length > 0 && <div className="my-0.5 h-px bg-border" />}

      <AllPlayersRow
        value={defaultPermissionLevel}
        disabled={disabled}
        expanded={showPlayers}
        inheritingMembers={defaultItems.map((item) => item.participant)}
        onToggleExpand={() => setShowPlayers((prev) => !prev)}
        onChange={onSetAllPlayersPermission}
      />

      {showPlayers && (
        <div className="ml-4">
          {defaultItems.length > 0 ? (
            defaultItems.map((item, index) => (
              <ShareMenuTreeItem key={item.key} isLast={index === defaultItems.length - 1}>
                <PlayerRow
                  shareItem={item}
                  defaultValue={defaultPermissionLevel}
                  disabled={disabled}
                  onChange={(value) => onSetMemberPermission(item.participant.id, value)}
                />
              </ShareMenuTreeItem>
            ))
          ) : (
            <ShareMenuTreeItem isLast>
              <div className="py-1 pl-1 text-xs text-muted-foreground">
                Players that join the workspace will have this value
              </div>
            </ShareMenuTreeItem>
          )}
        </div>
      )}

      {lockedItems.length > 0 && (
        <>
          <div className="my-0.5 h-px bg-border" />
          {lockedItems.map((item) => (
            <LockedPlayerRow key={item.key} shareItem={item} />
          ))}
        </>
      )}

      {shareItems.length === 0 && (
        <div className="p-1">
          <div className="text-xs text-muted-foreground">No players in this workspace yet.</div>
        </div>
      )}
    </div>
  )
}

function AllPlayersRow({
  value,
  disabled,
  expanded,
  inheritingMembers,
  onToggleExpand,
  onChange,
}: {
  value: AggregateBlockVisibilitySelectValue
  disabled: boolean
  expanded: boolean
  inheritingMembers: Array<EditorShareParticipant>
  onToggleExpand: () => void
  onChange: (value: BlockAllPlayersPermissionValue) => Promise<unknown>
}) {
  const infoText =
    value === 'mixed'
      ? 'The selected blocks have different All Players visibility settings.'
      : 'This is the default block visibility for players with view-level note access.'

  return (
    <ShareMenuAllPlayersRow
      label="All Players"
      tooltipText={infoText}
      expanded={expanded}
      members={inheritingMembers}
      testId="block-share-all-players-row"
      onToggleExpand={onToggleExpand}
      select={
        <Select
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue === 'hidden' || nextValue === 'visible') void onChange(nextValue)
          }}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="h-7 min-w-[110px] text-xs">
            <SelectValue>{visibilityLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent
            className="p-1"
            align="end"
            alignItemWithTrigger={false}
            data-block-share-menu-overlay="true"
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
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  )
}

function PlayerRow({
  shareItem,
  defaultValue,
  disabled,
  onChange,
}: {
  shareItem: BlockShareItem
  defaultValue: AggregateBlockVisibilitySelectValue
  disabled: boolean
  onChange: (value: BlockVisibilitySelectValue) => Promise<unknown>
}) {
  const { participant, permissionLevel, hasExplicitShare } = shareItem
  const selectValue = hasExplicitShare ? permissionLevel : 'default'
  const selectLabel = hasExplicitShare ? permissionLevel : defaultValue
  const name = participant.displayName
  const infoText =
    permissionLevel === 'mixed'
      ? `${name}'s block visibility differs across the selected blocks.`
      : hasExplicitShare
        ? `${name}'s block visibility has been explicitly set. Remove returns them to the All Players block setting.`
        : defaultValue === 'mixed'
          ? `${name}'s block visibility is based on the All Players setting, which differs across the selected blocks.`
          : `${name}'s block visibility is based on the All Players block setting.`

  return (
    <ShareMenuRowTooltip
      text={infoText}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
      memberId={participant.id}
      shareKind={shareItem.kind}
      testId="block-share-player-row"
    >
      <ShareMenuPlayerIdentity member={participant} />
      <Select
        value={selectValue}
        onValueChange={(value) => {
          if (value === 'default' || value === 'hidden' || value === 'visible') {
            void onChange(value)
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="h-7 min-w-[110px] text-xs">
          <SelectValue>{visibilityLabel(selectLabel)}</SelectValue>
        </SelectTrigger>
        <SelectContent
          className="p-1"
          align="end"
          alignItemWithTrigger={false}
          data-block-share-menu-overlay="true"
          data-item-surface-floating-command="true"
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
            <SelectItem value="default">Default ({visibilityLabel(defaultValue)})</SelectItem>
          )}
          <SelectItem value="hidden">Hidden</SelectItem>
          <SelectItem value="visible">Visible</SelectItem>
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
      {participant.username && <span className="sr-only">@{participant.username}</span>}
    </ShareMenuRowTooltip>
  )
}

function LockedPlayerRow({ shareItem }: { shareItem: BlockShareItem }) {
  const name = shareItem.participant.displayName

  return (
    <ShareMenuRowTooltip
      text={`${name} can edit this note, so they can see every block.`}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
      memberId={shareItem.participant.id}
      shareKind={shareItem.kind}
      testId="block-share-player-row"
    >
      <ShareMenuPlayerIdentity member={shareItem.participant} />
      <div
        className="flex h-7 min-w-[110px] items-center justify-between rounded-md border border-input bg-muted px-2 text-xs text-muted-foreground"
        data-testid="block-share-locked-visible"
      >
        <span>Visible</span>
        <Lock className="size-3" />
      </div>
    </ShareMenuRowTooltip>
  )
}

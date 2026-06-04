import { Lock } from 'lucide-react'
import { useState } from 'react'
import type {
  AggregateBlockVisibilitySelectValue,
  BlockShareItem,
  BlockVisibilitySelectValue,
} from '~/features/sharing/hooks/useBlocksShare'
import type { CampaignMember } from 'shared/campaigns/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/features/shadcn/components/select'
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

type ShareMemberId = BlockShareItem['member']['_id']

function visibilityLabel(value: AggregateBlockVisibilitySelectValue): string {
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
  isPending: boolean
  isMutating: boolean
  shareItems: Array<BlockShareItem>
  allPlayersPermissionLevel: AggregateBlockVisibilitySelectValue
  onSetAllPlayersPermission: (
    value: Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'>,
  ) => Promise<void>
  onSetMemberPermission: (
    memberId: ShareMemberId,
    value: BlockVisibilitySelectValue,
  ) => Promise<void>
}

export function BlockSharePermissionMenu({
  title = 'Share',
  isPending,
  isMutating,
  shareItems,
  allPlayersPermissionLevel,
  onSetAllPlayersPermission,
  onSetMemberPermission,
}: BlockSharePermissionMenuProps) {
  const [showPlayers, setShowPlayers] = useState(true)
  const disabled = isPending || isMutating

  if (isPending) {
    return (
      <div className="py-2 px-1">
        <div className="text-xs text-muted-foreground">Loading&hellip;</div>
      </div>
    )
  }

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
          defaultValue={allPlayersPermissionLevel}
          disabled={disabled}
          onChange={(value) => onSetMemberPermission(item.member._id, value)}
        />
      ))}

      {explicitItems.length > 0 && <div className="my-0.5 h-px bg-border" />}

      <AllPlayersRow
        value={allPlayersPermissionLevel}
        disabled={disabled}
        expanded={showPlayers}
        inheritingMembers={defaultItems.map((item) => item.member)}
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
                  defaultValue={allPlayersPermissionLevel}
                  disabled={disabled}
                  onChange={(value) => onSetMemberPermission(item.member._id, value)}
                />
              </ShareMenuTreeItem>
            ))
          ) : (
            <ShareMenuTreeItem isLast>
              <div className="py-1 pl-1 text-xs text-muted-foreground">
                Players that join the campaign will have this value
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
          <div className="text-xs text-muted-foreground">No players in this campaign yet.</div>
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
  inheritingMembers: Array<CampaignMember>
  onToggleExpand: () => void
  onChange: (value: Extract<BlockVisibilitySelectValue, 'hidden' | 'visible'>) => Promise<void>
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
  onChange: (value: BlockVisibilitySelectValue) => Promise<void>
}) {
  const { member, permissionLevel, hasExplicitShare } = shareItem
  const profile = member.userProfile
  const selectValue = hasExplicitShare ? permissionLevel : 'default'
  const selectLabel = hasExplicitShare ? permissionLevel : defaultValue
  const name = getUserDisplayName(profile)
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
      memberId={member._id}
      shareKind={shareItem.kind}
      testId="block-share-player-row"
    >
      <ShareMenuPlayerIdentity member={member} />
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
      {profile.name && profile.username && <span className="sr-only">@{profile.username}</span>}
    </ShareMenuRowTooltip>
  )
}

function LockedPlayerRow({ shareItem }: { shareItem: BlockShareItem }) {
  const name = getUserDisplayName(shareItem.member.userProfile)

  return (
    <ShareMenuRowTooltip
      text={`${name} can edit this note, so they can see every block.`}
      className="flex items-center gap-2.5 px-1 py-1.5 select-none"
      memberId={shareItem.member._id}
      shareKind={shareItem.kind}
      testId="block-share-player-row"
    >
      <ShareMenuPlayerIdentity member={shareItem.member} />
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

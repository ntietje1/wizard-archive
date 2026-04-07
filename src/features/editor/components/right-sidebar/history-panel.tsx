import { useMemo } from 'react'
import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'

function formatActionDescription(
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) {
    switch (action) {
      case 'created':
        return 'created this item'
      case 'content_edited':
        return 'edited content'
      case 'trashed':
        return 'moved to trash'
      case 'restored':
        return 'restored from trash'
      case 'icon_changed':
        return 'changed the icon'
      case 'color_changed':
        return 'changed the color'
      case 'image_changed':
        return 'changed the map image'
      case 'image_removed':
        return 'removed the map image'
      case 'file_replaced':
        return 'replaced the file'
      case 'file_removed':
        return 'removed the file'
      case 'permission_changed':
        return 'changed permissions'
      case 'block_share_changed':
        return 'changed block sharing'
      default:
        return action
    }
  }

  switch (action) {
    case 'renamed':
      return `renamed "${metadata.from}" to "${metadata.to}"`
    case 'moved':
      return `moved from ${metadata.from ? `"${metadata.from}"` : 'root'} to ${metadata.to ? `"${metadata.to}"` : 'root'}`
    case 'pin_added':
      return `added pin "${metadata.pinItemName}"`
    case 'pin_moved':
      return `moved pin "${metadata.pinItemName}"`
    case 'pin_removed':
      return `removed pin "${metadata.pinItemName}"`
    case 'pin_visibility_changed':
      return `${metadata.visible ? 'showed' : 'hid'} pin "${metadata.pinItemName}"`
    case 'shared':
      return `shared with ${metadata.memberName}`
    case 'unshared':
      return `unshared from ${metadata.memberName}`
    case 'permission_changed':
      return `set permission to ${metadata.level ?? 'all players'}`
    case 'inherit_shares_changed':
      return metadata.inheritShares
        ? 'enabled share inheritance'
        : 'disabled share inheritance'
    default:
      return formatActionDescription(action, null)
  }
}

function groupByDay(
  entries: Array<HistoryEntry>,
): Array<{ label: string; entries: Array<HistoryEntry> }> {
  const groups = new Map<string, Array<HistoryEntry>>()

  for (const entry of entries) {
    const date = new Date(entry._creationTime)
    const key = date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const existing = groups.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  return Array.from(groups.entries()).map(([label, groupEntries]) => ({
    label,
    entries: groupEntries,
  }))
}

type HistoryEntry = {
  _id: Id<'editHistory'>
  _creationTime: number
  itemId: SidebarItemId
  itemType: string
  campaignId: Id<'campaigns'>
  campaignMemberId: Id<'campaignMembers'>
  action: string
  metadata: Record<string, unknown> | null
}

export function HistoryPanel({ itemId }: { itemId: SidebarItemId }) {
  const historyQuery = useAuthQuery(api.editHistory.queries.getItemHistory, {
    itemId,
  })

  const membersQuery = useCampaignMembers()
  const { campaign } = useCampaign()
  const myMemberId = campaign.data?.myMembership?._id

  const membersMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string
        imageUrl: string | null
        imageStorageId: Id<'_storage'> | null
      }
    >()
    if (membersQuery.data) {
      for (const m of membersQuery.data) {
        map.set(m._id, {
          name:
            m.userProfile.name ??
            (m.userProfile.username ? `@${m.userProfile.username}` : 'Unknown'),
          imageUrl: m.userProfile.imageUrl,
          imageStorageId: m.userProfile.imageStorageId,
        })
      }
    }
    return map
  }, [membersQuery.data])

  const entries = (historyQuery.data ?? []) as Array<HistoryEntry>
  const dayGroups = groupByDay(entries)

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {historyQuery.isPending && (
          <p className="text-sm text-muted-foreground p-4 text-center">
            Loading history...
          </p>
        )}

        {!historyQuery.isPending && entries.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">
            No history yet.
          </p>
        )}

        {dayGroups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b border-border/50">
              <span className="text-xs font-medium text-muted-foreground">
                {group.label}
              </span>
            </div>
            {group.entries.map((entry) => {
              const member = membersMap.get(entry.campaignMemberId)
              const isCurrentUser = entry.campaignMemberId === myMemberId
              const displayName = isCurrentUser
                ? 'You'
                : (member?.name ?? 'Unknown')
              const initials = (member?.name ?? '?')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              return (
                <div
                  key={entry._id}
                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50"
                >
                  <Avatar size="sm" className="mt-0.5 shrink-0">
                    {member?.imageUrl && <AvatarImage src={member.imageUrl} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{displayName}</span>{' '}
                      <span className="text-muted-foreground">
                        {formatActionDescription(entry.action, entry.metadata)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(entry._creationTime)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

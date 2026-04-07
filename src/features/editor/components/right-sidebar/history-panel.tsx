import { useEffect, useMemo, useRef } from 'react'
import { api } from 'convex/_generated/api'
import { Loader2 } from 'lucide-react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { EditHistoryEntry } from 'convex/editHistory/types'
import { assertNever } from '~/shared/utils/utils'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'

function formatActionDescription(entry: EditHistoryEntry): string {
  switch (entry.action) {
    case 'created':
      return 'created this item'
    case 'renamed':
      return `renamed "${entry.metadata.from}" to "${entry.metadata.to}"`
    case 'moved':
      return `moved from ${entry.metadata.from ? `"${entry.metadata.from}"` : 'root'} to ${entry.metadata.to ? `"${entry.metadata.to}"` : 'root'}`
    case 'trashed':
      return 'moved to trash'
    case 'restored':
      return 'restored from trash'
    case 'icon_changed':
      return entry.metadata.to
        ? `changed icon to "${entry.metadata.to}"`
        : 'removed the icon'
    case 'color_changed':
      return entry.metadata.to
        ? `changed color to "${entry.metadata.to}"`
        : 'removed the color'
    case 'content_edited':
      return 'edited content'
    case 'map_image_changed':
      return 'changed the map image'
    case 'map_image_removed':
      return 'removed the map image'
    case 'file_replaced':
      return 'replaced the file'
    case 'file_removed':
      return 'removed the file'
    case 'map_pin_added':
      return `added pin "${entry.metadata.pinItemName}"`
    case 'map_pin_moved':
      return `moved pin "${entry.metadata.pinItemName}"`
    case 'map_pin_removed':
      return `removed pin "${entry.metadata.pinItemName}"`
    case 'map_pin_visibility_changed':
      return `${entry.metadata.visible ? 'showed' : 'hid'} pin "${entry.metadata.pinItemName}"`
    case 'permission_changed': {
      const { memberName, level } = entry.metadata
      if (memberName) {
        return level
          ? `set ${memberName}'s access to ${level}`
          : `removed ${memberName}'s access`
      }
      return level
        ? `set all players' access to ${level}`
        : `removed all players' access`
    }
    case 'block_share_changed':
      return entry.metadata.status === 'shared'
        ? 'shared blocks with players'
        : 'unshared blocks from players'
    case 'inherit_shares_changed':
      return entry.metadata.inheritShares
        ? 'enabled share inheritance'
        : 'disabled share inheritance'
    default:
      assertNever(entry)
  }
}

function groupByDay(
  entries: Array<EditHistoryEntry>,
): Array<{ label: string; entries: Array<EditHistoryEntry> }> {
  const groups = new Map<string, Array<EditHistoryEntry>>()

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

const PAGE_SIZE = 20

export function HistoryPanel({ itemId }: { itemId: SidebarItemId }) {
  const { results, status, loadMore } = useAuthPaginatedQuery(
    api.editHistory.queries.getItemHistory,
    { itemId },
    { initialNumItems: PAGE_SIZE },
  )

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

  const entries = (results ?? []) as Array<EditHistoryEntry>
  const dayGroups = groupByDay(entries)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const viewport = viewportRef.current
    if (!sentinel || !viewport) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && status === 'CanLoadMore') {
          loadMore(PAGE_SIZE)
        }
      },
      { root: viewport, rootMargin: '100px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [status, loadMore])

  return (
    <div className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
        {status === 'LoadingFirstPage' && (
          <p className="text-sm text-muted-foreground p-4 text-center">
            Loading history...
          </p>
        )}

        {status !== 'LoadingFirstPage' && entries.length === 0 && (
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

              const description = formatActionDescription(entry)

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
                        {description}
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

        {status === 'LoadingMore' && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
      </ScrollArea>
    </div>
  )
}

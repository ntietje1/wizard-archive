import { useMemo } from 'react'
import { api } from 'convex/_generated/api'
import { X } from 'lucide-react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '~/features/shadcn/components/avatar'
import { Button } from '~/features/shadcn/components/button'

const ACTION_LABELS: Record<string, string> = {
  created: 'Created this item',
  renamed: 'Renamed',
  moved: 'Moved',
  trashed: 'Moved to trash',
  restored: 'Restored from trash',
  icon_changed: 'Changed icon',
  color_changed: 'Changed color',
  content_edited: 'Edited content',
  image_changed: 'Changed map image',
  file_replaced: 'Replaced file',
  pin_added: 'Added pin',
  pin_moved: 'Moved pin',
  pin_removed: 'Removed pin',
  pin_visibility_changed: 'Changed pin visibility',
  shared: 'Shared',
  unshared: 'Unshared',
  permission_changed: 'Changed permissions',
  block_share_changed: 'Changed block sharing',
  inherit_shares_changed: 'Changed share inheritance',
}

function formatActionDescription(
  action: string,
  metadata: Record<string, unknown> | null,
): string {
  const base = ACTION_LABELS[action] ?? action

  if (!metadata) return base

  switch (action) {
    case 'renamed':
      return `Renamed "${metadata.from}" to "${metadata.to}"`
    case 'moved':
      return `Moved from ${metadata.from ? `"${metadata.from}"` : 'root'} to ${metadata.to ? `"${metadata.to}"` : 'root'}`
    case 'pin_added':
    case 'pin_moved':
    case 'pin_removed':
      return `${base} "${metadata.pinItemName}"`
    case 'pin_visibility_changed':
      return `${metadata.visible ? 'Showed' : 'Hid'} pin "${metadata.pinItemName}"`
    case 'shared':
      return `Shared with ${metadata.memberName}`
    case 'unshared':
      return `Unshared from ${metadata.memberName}`
    case 'permission_changed':
      return `Set permission to ${metadata.level ?? 'all players'}`
    case 'inherit_shares_changed':
      return metadata.inheritShares
        ? 'Enabled share inheritance'
        : 'Disabled share inheritance'
    default:
      return base
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function groupByDay(
  entries: Array<{ _creationTime: number; [key: string]: unknown }>,
): Array<{ label: string; entries: typeof entries }> {
  const groups = new Map<string, typeof entries>()

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

export function HistoryPanel({
  itemId,
  onClose,
}: {
  itemId: SidebarItemId
  onClose: () => void
}) {
  const historyQuery = useAuthQuery(api.editHistory.queries.getItemHistory, {
    itemId,
  })

  const membersQuery = useCampaignMembers()

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
    <div className="w-72 border-l border-border flex flex-col bg-background shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-sm font-medium">History</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {entries.length === 0 && (
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
              const e = entry as HistoryEntry
              const member = membersMap.get(e.campaignMemberId)
              const initials = (member?.name ?? '?')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              return (
                <div
                  key={e._id}
                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50"
                >
                  <Avatar size="sm" className="mt-0.5 shrink-0">
                    {member?.imageUrl && <AvatarImage src={member.imageUrl} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">
                        {member?.name ?? 'Unknown'}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {formatActionDescription(e.action, e.metadata)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(e._creationTime)}
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

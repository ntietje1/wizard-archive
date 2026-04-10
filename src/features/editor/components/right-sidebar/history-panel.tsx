import { useEffect, useRef } from 'react'
import { api } from 'convex/_generated/api'
import { Loader2, RotateCcw } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { CampaignMember } from 'convex/campaigns/types'
import type { EditHistoryEntry } from 'convex/editHistory/types'
import { useAuthPaginatedQuery } from '~/shared/hooks/useAuthPaginatedQuery'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { UserProfileImage } from '~/shared/components/user-profile-image'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import { cn } from '~/features/shadcn/lib/utils'

function str(value: unknown, fallback = '(unknown)'): string {
  return typeof value === 'string' ? value : fallback
}

function formatSingleAction(action: string, metadata: Record<string, unknown> | null): string {
  switch (action) {
    case 'created':
      return 'created this item'
    case 'renamed':
      return `renamed "${str(metadata?.from)}" to "${str(metadata?.to)}"`
    case 'moved':
      return `moved from ${metadata?.from ? `"${str(metadata.from)}"` : 'root'} to ${metadata?.to ? `"${str(metadata.to)}"` : 'root'}`
    case 'trashed':
      return 'moved to trash'
    case 'restored':
      return 'restored from trash'
    case 'icon_changed':
      return metadata?.to ? `changed icon to "${str(metadata.to)}"` : 'removed the icon'
    case 'color_changed':
      return metadata?.to ? `changed color to "${str(metadata.to)}"` : 'removed the color'
    case 'content_edited':
      return 'edited content'
    case 'rolled_back':
      return 'restored a previous version'
    case 'map_image_changed':
      return 'changed the map image'
    case 'map_image_removed':
      return 'removed the map image'
    case 'file_replaced':
      return 'replaced the file'
    case 'file_removed':
      return 'removed the file'
    case 'map_pin_added':
      return `added pin "${str(metadata?.pinItemName, '(unnamed)')}"`
    case 'map_pin_moved':
      return `moved pin "${str(metadata?.pinItemName, '(unnamed)')}"`
    case 'map_pin_removed':
      return `removed pin "${str(metadata?.pinItemName, '(unnamed)')}"`
    case 'map_pin_visibility_changed':
      return `${metadata?.visible ? 'showed' : 'hid'} pin "${str(metadata?.pinItemName, '(unnamed)')}"`
    case 'permission_changed': {
      const memberName = metadata?.memberName as string | null
      const level = metadata?.level as string | null
      if (memberName) {
        return level ? `set ${memberName}'s access to ${level}` : `removed ${memberName}'s access`
      }
      return level ? `set all players' access to ${level}` : `removed all players' access`
    }
    case 'block_share_changed':
      return metadata?.status === 'shared'
        ? 'shared blocks with players'
        : 'unshared blocks from players'
    case 'inherit_shares_changed':
      return (metadata?.inheritShares as boolean)
        ? 'enabled share inheritance'
        : 'disabled share inheritance'
    default:
      return action
  }
}

function formatActionDescription(entry: EditHistoryEntry): string | Array<string> {
  if (entry.action === 'updated') {
    const changes = Array.isArray(entry.metadata?.changes)
      ? (entry.metadata.changes as Array<{
          action: string
          metadata: Record<string, unknown> | null
        }>)
      : []
    if (changes.length === 0) {
      return formatSingleAction(entry.action, entry.metadata as Record<string, unknown> | null)
    }
    if (changes.length === 1) {
      return formatSingleAction(changes[0].action, changes[0].metadata)
    }
    return changes.map((c) => formatSingleAction(c.action, c.metadata))
  }
  return formatSingleAction(entry.action, entry.metadata as Record<string, unknown> | null)
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

export function HistoryPanel({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const {
    results = [],
    status,
    loadMore,
  } = useAuthPaginatedQuery(
    api.editHistory.queries.getItemHistory,
    { itemId },
    { initialNumItems: PAGE_SIZE },
  )

  const membersQuery = useCampaignMembers()
  const { campaign } = useCampaign()
  const { canEdit } = useEditorMode()
  const myMemberId = campaign.data?.myMembership?._id
  const previewingEntryId = useHistoryPreviewStore((s) => s.previewingEntryId)
  const setPreviewingEntry = useHistoryPreviewStore((s) => s.setPreviewingEntry)
  const setRollbackEntryId = useHistoryPreviewStore((s) => s.setRollbackEntryId)

  const membersMap = new Map<string, CampaignMember>()
  if (membersQuery.data) {
    for (const m of membersQuery.data) {
      membersMap.set(m._id, m)
    }
  }

  const entries = results as Array<EditHistoryEntry>
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
    <div data-testid="history-panel" className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
        {status === 'LoadingFirstPage' && (
          <p className="text-sm text-muted-foreground p-4 text-center">Loading history...</p>
        )}

        {status !== 'LoadingFirstPage' && entries.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">No history yet.</p>
        )}

        {dayGroups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 border-b border-border/50">
              <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
            </div>
            {group.entries.map((entry) => {
              const member = membersMap.get(entry.campaignMemberId)
              const profile = member?.userProfile
              const isCurrentUser = entry.campaignMemberId === myMemberId
              const displayName = isCurrentUser
                ? 'You'
                : (profile?.name ?? (profile?.username ? `@${profile.username}` : 'Unknown'))
              const description = formatActionDescription(entry)
              const isSelected = previewingEntryId === entry._id
              const hasSnapshot = entry.hasSnapshot
              const descriptions = Array.isArray(description) ? description : [description]

              return (
                <div
                  key={entry._id}
                  role={hasSnapshot ? 'button' : undefined}
                  tabIndex={hasSnapshot ? 0 : undefined}
                  aria-pressed={hasSnapshot ? isSelected : undefined}
                  className={cn(
                    'relative flex items-start gap-2.5 px-3 py-2',
                    hasSnapshot ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30',
                    isSelected && 'bg-accent shadow-[inset_2px_0_0_0_var(--primary)]',
                  )}
                  onClick={
                    hasSnapshot
                      ? () => setPreviewingEntry(isSelected ? null : entry._id)
                      : undefined
                  }
                  onKeyDown={
                    hasSnapshot
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setPreviewingEntry(isSelected ? null : entry._id)
                          }
                        }
                      : undefined
                  }
                >
                  <UserProfileImage
                    imageUrl={profile?.imageUrl}
                    name={profile?.name}
                    size="sm"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    {descriptions.length === 1 ? (
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{displayName}</span>{' '}
                        <span className="text-muted-foreground">{descriptions[0]}</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-sm leading-snug">
                          <span className="font-medium">{displayName}</span>{' '}
                          <span className="text-muted-foreground">
                            made {descriptions.length} changes
                          </span>
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {descriptions.map((desc, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground pl-2 border-l border-border/50"
                            >
                              {desc}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(entry._creationTime)}
                    </p>
                  </div>
                  {hasSnapshot && canEdit && (
                    <button
                      type="button"
                      aria-label="Restore this version"
                      className={cn(
                        'relative z-10 mt-0.5 shrink-0 h-6 w-6 flex items-center justify-center rounded-md',
                        'text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        setRollbackEntryId(entry._id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
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

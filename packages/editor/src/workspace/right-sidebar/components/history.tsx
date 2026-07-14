import { useEffect, useRef } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import type { HistoryEntryId } from '../../../resources/domain-id'
import type { ResourceHistory } from '../../../filesystem/history-types'
import type { EditHistoryEntry } from '../../../filesystem/history-contract'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import { formatRelativeTime } from '@wizard-archive/ui/utils/format-relative-time'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { getUserDisplayName } from '@wizard-archive/ui/utils/user-display-name'

type HistoryEntriesState = Extract<ResourceHistory, { status: 'available' }>['entries']['state']

function str(value: unknown, fallback = '(unknown)'): string {
  return typeof value === 'string' ? value : fallback
}

const SIMPLE_ACTION_DESCRIPTIONS: Record<string, string> = {
  created: 'created this item',
  trashed: 'moved to trash',
  restored: 'restored from trash',
  content_edited: 'edited content',
  rolled_back: 'restored a previous version',
  map_image_changed: 'changed the map image',
  map_image_removed: 'removed the map image',
  file_replaced: 'replaced the file',
  file_removed: 'removed the file',
}

const ACTION_FORMATTERS: Record<string, (metadata: Record<string, unknown> | null) => string> = {
  copied: (metadata) => `copied from "${str(metadata?.copiedFromName, '(unnamed)')}"`,
  renamed: (metadata) => `renamed "${str(metadata?.from)}" to "${str(metadata?.to)}"`,
  moved: (metadata) =>
    `moved from ${metadata?.from ? `"${str(metadata.from)}"` : 'root'} to ${metadata?.to ? `"${str(metadata.to)}"` : 'root'}`,
  icon_changed: (metadata) =>
    metadata?.to ? `changed icon to "${str(metadata.to)}"` : 'removed the icon',
  color_changed: (metadata) =>
    metadata?.to ? `changed color to "${str(metadata.to)}"` : 'removed the color',
  map_pin_added: (metadata) => `added pin "${str(metadata?.pinItemName, '(unnamed)')}"`,
  map_pin_moved: (metadata) => `moved pin "${str(metadata?.pinItemName, '(unnamed)')}"`,
  map_pin_removed: (metadata) => `removed pin "${str(metadata?.pinItemName, '(unnamed)')}"`,
  map_pin_visibility_changed: (metadata) =>
    `${metadata?.visible ? 'showed' : 'hid'} pin "${str(metadata?.pinItemName, '(unnamed)')}"`,
  permission_changed: (metadata) => {
    const memberName = metadata?.memberName as string | null
    const level = metadata?.level as string | null
    if (memberName) {
      return level ? `set ${memberName}'s access to ${level}` : `removed ${memberName}'s access`
    }
    return level ? `set all players' access to ${level}` : `removed all players' access`
  },
  block_share_changed: (metadata) =>
    metadata?.status === 'shared' ? 'shared blocks with players' : 'unshared blocks from players',
  inherit_shares_changed: (metadata) =>
    (metadata?.inheritShares as boolean)
      ? 'enabled share inheritance'
      : 'disabled share inheritance',
}

function formatSingleAction(action: string, metadata: Record<string, unknown> | null): string {
  const simpleDescription = Object.prototype.hasOwnProperty.call(SIMPLE_ACTION_DESCRIPTIONS, action)
    ? SIMPLE_ACTION_DESCRIPTIONS[action]
    : undefined
  const formatter = Object.prototype.hasOwnProperty.call(ACTION_FORMATTERS, action)
    ? ACTION_FORMATTERS[action]
    : undefined
  return simpleDescription ?? formatter?.(metadata) ?? action
}

function isMetadataRecord(metadata: unknown): metadata is Record<string, unknown> {
  return metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  return isMetadataRecord(metadata) ? metadata : null
}

function isHistoryChange(value: unknown): value is {
  action: string
  metadata: Record<string, unknown> | null
} {
  if (!value || typeof value !== 'object') return false
  if (!('action' in value) || typeof value.action !== 'string') return false
  if (!('metadata' in value)) return false
  return (
    value.metadata === null ||
    (typeof value.metadata === 'object' && !Array.isArray(value.metadata))
  )
}

function formatActionDescription(entry: EditHistoryEntry): string | Array<string> {
  if (entry.action === 'updated') {
    const changes = Array.isArray(entry.metadata?.changes)
      ? entry.metadata.changes.filter(isHistoryChange)
      : []
    if (changes.length === 0) {
      return formatSingleAction(entry.action, metadataRecord(entry.metadata))
    }
    if (changes.length === 1) {
      return formatSingleAction(changes[0].action, changes[0].metadata)
    }
    return changes.map((c) => formatSingleAction(c.action, c.metadata))
  }
  return formatSingleAction(entry.action, metadataRecord(entry.metadata))
}

function groupByDay(
  entries: Array<EditHistoryEntry>,
): Array<{ label: string; entries: Array<EditHistoryEntry> }> {
  const groups = new Map<string, Array<EditHistoryEntry>>()

  for (const entry of entries) {
    const date = new Date(entry.createdAt)
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

function keyedDescriptions(entryId: HistoryEntryId, descriptions: Array<string>) {
  const descriptionCounts = new Map<string, number>()

  return descriptions.map((description) => {
    const duplicateCount = descriptionCounts.get(description) ?? 0
    descriptionCounts.set(description, duplicateCount + 1)
    return {
      description,
      key: `${entryId}-${description}-${duplicateCount}`,
    }
  })
}

export function HistoryPanel({
  onLoadMore,
  onPreviewEntryChange,
  onRollbackEntry,
  state,
}: {
  onLoadMore: () => void
  onPreviewEntryChange: (entryId: HistoryEntryId | null) => void
  onRollbackEntry: (entryId: HistoryEntryId) => void
  state: HistoryEntriesState
}) {
  const { canEdit, entries, membersMap, myMemberId, previewingEntryId, status } = state
  const dayGroups = groupByDay(entries)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const sentinel = sentinelRef.current
    const viewport = viewportRef.current
    if (!sentinel || !viewport) return

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0]?.isIntersecting && status === 'CanLoadMore') {
          onLoadMoreRef.current()
        }
      },
      { root: viewport, rootMargin: '100px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [status])

  return (
    <div data-testid="history-panel" className="flex flex-col h-full bg-background">
      <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
        {status === 'LoadingFirstPage' && (
          <p className="text-sm text-muted-foreground p-4 text-center">Loading history…</p>
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
              const member = membersMap.get(entry.memberId)
              const isCurrentUser = entry.memberId === myMemberId
              const displayName = isCurrentUser ? 'You' : getUserDisplayName(member, 'Unknown')
              const description = formatActionDescription(entry)
              const isSelected = previewingEntryId === entry.id
              const hasSnapshot = entry.hasSnapshot
              const descriptions = Array.isArray(description) ? description : [description]

              const entryContent = (
                <>
                  <UserProfileImage
                    imageUrl={member?.imageUrl}
                    name={member?.name}
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
                          {keyedDescriptions(entry.id, descriptions).map(
                            ({ description: descriptionText, key }) => (
                              <li
                                key={key}
                                className="text-xs text-muted-foreground pl-2 border-l border-border/50"
                              >
                                {descriptionText}
                              </li>
                            ),
                          )}
                        </ul>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                </>
              )
              const restoreButton =
                hasSnapshot && canEdit ? (
                  <button
                    type="button"
                    aria-label="Restore this version"
                    className={cn(
                      'relative z-10 mt-0.5 shrink-0 size-6 flex items-center justify-center rounded-md',
                      'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRollbackEntry(entry.id)
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                ) : null
              const rowClassName = cn(
                'relative flex w-full items-start gap-2.5 px-3 py-2 text-left',
                hasSnapshot ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30',
                isSelected && 'bg-accent shadow-[inset_2px_0_0_0_var(--primary)]',
              )

              return hasSnapshot ? (
                <div key={entry.id} className={rowClassName}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className="flex min-w-0 flex-1 items-start gap-2.5 border-0 bg-transparent p-0 text-left text-foreground"
                    onClick={() => onPreviewEntryChange(isSelected ? null : entry.id)}
                  >
                    {entryContent}
                  </button>
                  {restoreButton}
                </div>
              ) : (
                <div key={entry.id} className={rowClassName}>
                  {entryContent}
                </div>
              )
            })}
          </div>
        ))}

        {status === 'LoadingMore' && (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <div ref={sentinelRef} className="h-px" />
      </ScrollArea>
    </div>
  )
}

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronRight, Clock3, FileText, Link2, List, Loader2, RotateCcw, X } from 'lucide-react'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import { formatRelativeTime } from '@wizard-archive/ui/utils/format-relative-time'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../../notes/document/headless-yjs'
import { noteDocumentOutline, noteOutlineTree } from '../../notes/document/outline'
import type {
  EditorRuntime,
  ItemHistoryEntry,
  ItemHistoryController,
  ResourceReferenceSource,
} from '../editor-runtime-contract'
import type { CampaignMemberId } from '../domain-id'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'
import type { NoteOutlineNode } from '../../notes/document/outline'
import type * as Y from 'yjs'
import type { NoteHeadingNavigationRef } from '../../notes/note-heading-navigation'
import { canonicalTargetKey } from '../authored-destination'
import { useWorkspaceIndexSnapshot } from './resource-store-snapshot'

type PanelId = 'details' | 'outline' | 'backlinks' | 'outgoing' | 'history'

export function ResourceRightSidebar({
  actions,
  activePanel,
  noteHeadingNavigation,
  onActivePanelChange,
  onClose,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  activePanel: PanelId
  noteHeadingNavigation: NoteHeadingNavigationRef
  onActivePanelChange: (panel: PanelId) => void
  onClose: () => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const panels = [
    { id: 'details' as const, label: 'Details', icon: FileText, available: true },
    { id: 'outline' as const, label: 'Outline', icon: List, available: resource.kind === 'note' },
    {
      id: 'backlinks' as const,
      label: 'Backlinks',
      icon: Link2,
      available: runtime.resources.references.status === 'available',
    },
    {
      id: 'outgoing' as const,
      label: 'Outgoing links',
      icon: Link2,
      available: runtime.resources.references.status === 'available',
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: Clock3,
      available: runtime.history.status === 'available' && resource.permission === 'edit',
    },
  ]
  const selected = panels.find((panel) => panel.id === activePanel && panel.available) ?? panels[0]
  return (
    <aside aria-label="Resource panel" className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-1">
        <div className="flex items-center gap-0.5">
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              aria-label={panel.label}
              aria-pressed={selected.id === panel.id}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground disabled:opacity-35"
              disabled={!panel.available}
              onClick={() => onActivePanelChange(panel.id)}
              title={panel.available ? panel.label : `${panel.label} is unavailable`}
            >
              <panel.icon className="size-3.5" />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close sidebar"
          className="inline-flex size-6 items-center justify-center rounded hover:bg-muted"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ResourcePanel
          actions={actions}
          noteHeadingNavigation={noteHeadingNavigation}
          panel={selected.id}
          resource={resource}
          runtime={runtime}
        />
      </div>
    </aside>
  )
}

function ResourcePanel({
  actions,
  noteHeadingNavigation,
  panel,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  noteHeadingNavigation: NoteHeadingNavigationRef
  panel: PanelId
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  if (panel === 'details') {
    return <ResourceDetails actions={actions} resource={resource} runtime={runtime} />
  }
  if (panel === 'outline') {
    return (
      <NoteOutlinePanel
        noteHeadingNavigation={noteHeadingNavigation}
        resource={resource}
        runtime={runtime}
      />
    )
  }
  if (panel === 'backlinks' || panel === 'outgoing') {
    if (runtime.resources.references.status !== 'available') {
      return <p className="p-3 text-sm text-muted-foreground">Links are unavailable.</p>
    }
    return (
      <ResourceReferencesPanel
        kind={panel}
        resource={resource}
        runtime={runtime}
        source={runtime.resources.references.value}
      />
    )
  }
  if (panel === 'history') return <ResourceHistoryPanel resource={resource} runtime={runtime} />
  throw new TypeError('Resource panel is unavailable')
}

function ResourceReferencesPanel({
  kind,
  resource,
  runtime,
  source,
}: {
  kind: 'backlinks' | 'outgoing'
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  source: ResourceReferenceSource
}) {
  const state = useSyncExternalStore(
    (listener) => source.subscribe(resource.id, listener),
    () => source.get(resource.id),
  )
  const index = useWorkspaceIndexSnapshot(runtime.resources.index)
  const label = kind === 'backlinks' ? 'backlinks' : 'outgoing links'
  if (state.status === 'loading') {
    return <p className="p-3 text-sm text-muted-foreground">Loading {label}…</p>
  }
  if (state.status === 'error') {
    return <p className="p-3 text-sm text-destructive">Could not load {label}.</p>
  }
  if (state.status === 'unavailable') {
    return <p className="p-3 text-sm text-muted-foreground">Links are unavailable.</p>
  }
  const direction = state[kind]
  if (direction.status === 'capacity_exceeded') {
    return <p className="p-3 text-sm text-muted-foreground">Too many {label} to display safely.</p>
  }
  const edges = direction.edges
  if (edges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <Link2 className="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">
          {kind === 'backlinks' ? 'No backlinks' : 'No outgoing links'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {kind === 'backlinks'
            ? 'Other resources do not link here yet'
            : 'This resource does not link to other resources yet'}
        </p>
      </div>
    )
  }
  return (
    <nav aria-label={kind === 'backlinks' ? 'Backlinks' : 'Outgoing links'} className="py-1">
      {edges.map((edge) => {
        const target =
          kind === 'backlinks'
            ? { kind: 'resource' as const, resourceId: edge.sourceResourceId }
            : edge.target
        const linked = index.lookup(target.resourceId)
        const title = linked.state === 'known' ? linked.value.title : 'Unavailable resource'
        return (
          <button
            key={`${edge.sourceResourceId}:${canonicalTargetKey(edge.target)}`}
            type="button"
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            disabled={linked.state !== 'known'}
            onClick={() => runtime.navigation.open(target)}
          >
            <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{title}</span>
              {kind === 'outgoing' && edge.target.kind !== 'resource' ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {referenceTargetLabel(edge.target.kind)}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function referenceTargetLabel(kind: 'noteBlock' | 'mapPin' | 'canvasNode') {
  switch (kind) {
    case 'noteBlock':
      return 'Note section'
    case 'mapPin':
      return 'Map pin'
    case 'canvasNode':
      return 'Canvas item'
  }
}

function NoteOutlinePanel({
  noteHeadingNavigation,
  resource,
  runtime,
}: {
  noteHeadingNavigation: NoteHeadingNavigationRef
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useSyncExternalStore(
    (listener) => runtime.content.notes.subscribe(resource.id, listener),
    () => runtime.content.notes.get(resource.id),
  )
  const document =
    state.status === 'initializing'
      ? state.local
      : state.status === 'ready'
        ? state.session.document
        : null
  if (!document) {
    return <p className="p-3 text-sm text-muted-foreground">Outline is unavailable.</p>
  }
  return <LiveNoteOutline document={document} noteHeadingNavigation={noteHeadingNavigation} />
}

function LiveNoteOutline({
  document: yDocument,
  noteHeadingNavigation,
}: {
  document: Y.Doc
  noteHeadingNavigation: NoteHeadingNavigationRef
}) {
  const [headings, setHeadings] = useState(() =>
    noteDocumentOutline(noteYDocToBlocks(yDocument, NOTE_YJS_FRAGMENT)),
  )
  useEffect(() => {
    const update = () =>
      setHeadings(noteDocumentOutline(noteYDocToBlocks(yDocument, NOTE_YJS_FRAGMENT)))
    update()
    yDocument.on('update', update)
    return () => yDocument.off('update', update)
  }, [yDocument])

  if (headings.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No headings yet.</p>
  }
  return (
    <nav aria-label="Note outline" className="p-2">
      {noteOutlineTree(headings).map((heading) => (
        <NoteOutlineItem
          key={heading.blockId}
          depth={0}
          heading={heading}
          noteHeadingNavigation={noteHeadingNavigation}
        />
      ))}
    </nav>
  )
}

function NoteOutlineItem({
  depth,
  heading,
  noteHeadingNavigation,
}: {
  depth: number
  heading: NoteOutlineNode
  noteHeadingNavigation: NoteHeadingNavigationRef
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = heading.children.length > 0
  return (
    <div>
      <div
        className="flex w-full items-center gap-1 rounded py-1 pr-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${heading.text}` : `Expand ${heading.text}`}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded hover:bg-foreground/10 focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronRight
              className={`size-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <button
          type="button"
          className="min-w-0 flex-1 truncate rounded text-left text-sm focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => noteHeadingNavigation.current?.(heading.blockId)}
        >
          {heading.text}
        </button>
      </div>
      {hasChildren && expanded
        ? heading.children.map((child) => (
            <NoteOutlineItem
              key={child.blockId}
              depth={depth + 1}
              heading={child}
              noteHeadingNavigation={noteHeadingNavigation}
            />
          ))
        : null}
    </div>
  )
}

function ResourceDetails({
  actions,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const location =
    ancestors.state === 'known' && ancestors.value.length > 0
      ? ancestors.value.map((ancestor) => ancestor.title).join(' / ')
      : 'Campaign root'
  return (
    <div className="p-3">
      <h2 className="text-sm font-medium">Details</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Kind</dt>
        <dd className="capitalize">{resource.kind}</dd>
        <dt className="text-muted-foreground">Location</dt>
        <dd className="break-words">{location}</dd>
        <dt className="text-muted-foreground">Lifecycle</dt>
        <dd className="capitalize">{resource.lifecycle}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatResourceTimestamp(resource.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{formatResourceTimestamp(resource.updatedAt)}</dd>
        <dt className="text-muted-foreground">Resource ID</dt>
        <dd className="break-all font-mono">{resource.id}</dd>
      </dl>
      {resource.kind === 'file' && <FileDetails resource={resource} runtime={runtime} />}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => void actions.copyLink(resource)}
        >
          Copy link
        </button>
        {resource.kind !== 'folder' && (
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            onClick={() => void actions.download(resource)}
          >
            Download
          </button>
        )}
      </div>
    </div>
  )
}

function FileDetails({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useSyncExternalStore(
    (listener) => runtime.content.files.subscribe(resource.id, listener),
    () => runtime.content.files.get(resource.id),
  )
  if (state.status !== 'ready') {
    return <p className="mt-4 text-xs text-muted-foreground">File metadata is unavailable.</p>
  }
  const metadata = state.content
  return (
    <>
      <h3 className="mt-5 text-xs font-medium">File metadata</h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Size</dt>
        <dd>{metadata.byteSize.toLocaleString('en-US')} bytes</dd>
        <dt className="text-muted-foreground">Media type</dt>
        <dd className="break-all">{metadata.mediaType}</dd>
        <dt className="text-muted-foreground">Extension</dt>
        <dd>{metadata.extension ?? 'None'}</dd>
        <dt className="text-muted-foreground">Detected format</dt>
        <dd>{metadata.detectedFormat ?? 'Unknown'}</dd>
        <dt className="text-muted-foreground">Classification</dt>
        <dd>{metadata.classification.replaceAll('_', ' ')}</dd>
        <dt className="text-muted-foreground">Viewer</dt>
        <dd>{metadata.viewerUnavailableReason ?? 'Available'}</dd>
      </dl>
    </>
  )
}

function ResourceHistoryPanel({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  if (runtime.history.status !== 'available' || resource.permission !== 'edit') {
    return <p className="p-3 text-sm text-muted-foreground">History is unavailable.</p>
  }
  return <AvailableResourceHistoryPanel resourceId={resource.id} source={runtime.history.value} />
}

function AvailableResourceHistoryPanel({
  resourceId,
  source,
}: {
  resourceId: AuthorizedResourceSummary['id']
  source: ItemHistoryController
}) {
  const state = useSyncExternalStore(
    (listener) => source.subscribe(resourceId, listener),
    () => source.get(resourceId),
  )
  const list = state.list
  if (list.status === 'loading') {
    return <p className="p-3 text-sm text-muted-foreground">Loading history…</p>
  }
  if (list.status === 'error') {
    return <p className="p-3 text-sm text-destructive">Could not load history.</p>
  }
  if (list.entries.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No history yet.</p>
  }
  const groups = groupHistoryEntriesByDay(list.entries)
  return (
    <ScrollArea className="h-full">
      <ol aria-label="Item history">
        {groups.map((group) => (
          <li key={group.label}>
            <h2 className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              {group.label}
            </h2>
            <ol>
              {group.entries.map((entry) => (
                <HistoryEntryRow
                  key={entry.id}
                  entry={entry}
                  onPreview={() =>
                    source.selectPreview(
                      resourceId,
                      state.preview.status !== 'closed' && state.preview.entryId === entry.id
                        ? null
                        : entry.id,
                    )
                  }
                  onRestore={() => source.requestRestore(resourceId, entry.id)}
                  selected={state.preview.status !== 'closed' && state.preview.entryId === entry.id}
                />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {list.pagination !== 'complete' ? (
        <div className="flex justify-center p-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            disabled={list.pagination === 'loading_more'}
            onClick={() => source.loadMore(resourceId)}
          >
            {list.pagination === 'loading_more' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </button>
        </div>
      ) : null}
    </ScrollArea>
  )
}

function HistoryEntryRow({
  entry,
  onPreview,
  onRestore,
  selected,
}: {
  entry: ItemHistoryEntry
  onPreview: () => void
  onRestore: () => void
  selected: boolean
}) {
  const content = (
    <>
      <UserProfileImage
        className="mt-0.5 shrink-0"
        imageUrl={entry.actor.imageUrl}
        name={entry.actor.displayName}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug">
          <span className="font-medium">{entry.actor.displayName}</span>{' '}
          <span className="text-muted-foreground">{historyEntryDescription(entry)}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatRelativeTime(entry.createdAt)}
        </span>
      </span>
    </>
  )
  if (!('checkpoint' in entry)) {
    return <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/30">{content}</li>
  }
  return (
    <li
      className={
        selected
          ? 'flex items-start gap-2.5 bg-accent px-3 py-2 shadow-[inset_2px_0_0_0_var(--primary)]'
          : 'flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50'
      }
    >
      <button
        type="button"
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        onClick={onPreview}
      >
        {content}
      </button>
      <button
        type="button"
        aria-label="Restore this version"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onRestore}
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  )
}

function groupHistoryEntriesByDay(entries: ReadonlyArray<ItemHistoryEntry>) {
  const groups = new Map<string, Array<ItemHistoryEntry>>()
  for (const entry of entries) {
    const label = new Date(entry.createdAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const group = groups.get(label)
    if (group) group.push(entry)
    else groups.set(label, [entry])
  }
  return [...groups].map(([label, groupedEntries]) => ({ label, entries: groupedEntries }))
}

function historyEntryDescription(entry: ItemHistoryEntry): string {
  return (
    SIMPLE_HISTORY_DESCRIPTIONS[entry.action] ??
    structureHistoryDescription(entry) ??
    accessAndMapHistoryDescription(entry)
  )
}

const SIMPLE_HISTORY_DESCRIPTIONS: Partial<Record<ItemHistoryEntry['action'], string>> = {
  created: 'created this item',
  trashed: 'moved to trash',
  restored: 'restored from trash',
  file_replaced: 'replaced the file',
  file_removed: 'removed the file',
  content_edited: 'edited content',
  content_restored: 'restored a previous version',
  map_image_changed: 'changed the map image',
  map_image_removed: 'removed the map image',
}

function structureHistoryDescription(entry: ItemHistoryEntry): string | null {
  switch (entry.action) {
    case 'copied':
      return `copied from "${entry.metadata.sourceTitle}"`
    case 'renamed':
      return `renamed "${entry.metadata.from}" to "${entry.metadata.to}"`
    case 'moved':
      return `moved from ${historyLocation(entry.metadata.from)} to ${historyLocation(entry.metadata.to)}`
    case 'icon_changed':
      return entry.metadata.to ? `changed icon to "${entry.metadata.to}"` : 'removed the icon'
    case 'color_changed':
      return entry.metadata.to ? `changed color to "${entry.metadata.to}"` : 'removed the color'
    default:
      return null
  }
}

function accessAndMapHistoryDescription(entry: ItemHistoryEntry): string {
  switch (entry.action) {
    case 'access_changed':
      return `changed ${historySubject(entry.metadata.subject)} access from ${entry.metadata.from} to ${entry.metadata.to}`
    case 'block_visibility_changed':
      return `${entry.metadata.visible ? 'showed' : 'hid'} ${entry.metadata.blockCount} ${entry.metadata.blockCount === 1 ? 'block' : 'blocks'} for ${historySubject(entry.metadata.subject)}`
    case 'inheritance_changed':
      return `${entry.metadata.to === 'enabled' ? 'enabled' : 'disabled'} share inheritance`
    case 'map_pin_added':
      return `added pin "${entry.metadata.pinLabel}"`
    case 'map_pin_moved':
      return `moved pin "${entry.metadata.pinLabel}"`
    case 'map_pin_removed':
      return `removed pin "${entry.metadata.pinLabel}"`
    case 'map_pin_visibility_changed':
      return `${entry.metadata.visible ? 'showed' : 'hid'} pin "${entry.metadata.pinLabel}"`
    default:
      throw new TypeError(`Missing item-history description for ${entry.action}`)
  }
}

function historyLocation(value: string | null) {
  return value ? `"${value}"` : 'root'
}

function historySubject(value: 'all_players' | CampaignMemberId) {
  return value === 'all_players' ? 'all players’' : 'a player’s'
}

export type ResourceRightSidebarPanel = PanelId

const resourceTimestampFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

function formatResourceTimestamp(timestamp: number) {
  return `${resourceTimestampFormat.format(timestamp)} UTC`
}

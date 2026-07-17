import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronRight, Clock3, FileText, Link2, List, X } from 'lucide-react'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../../notes/document/headless-yjs'
import { noteDocumentOutline, noteOutlineTree } from '../../notes/document/outline'
import type { EditorRuntime, ResourceHistoryEntry } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'
import type { NoteOutlineNode } from '../../notes/document/outline'
import type * as Y from 'yjs'
import type { NoteHeadingNavigationRef } from '../../notes/note-heading-navigation'

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
    { id: 'backlinks' as const, label: 'Backlinks', icon: Link2, available: false },
    { id: 'outgoing' as const, label: 'Outgoing links', icon: Link2, available: false },
    {
      id: 'history' as const,
      label: 'History',
      icon: Clock3,
      available: runtime.history.status === 'available',
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
  if (panel === 'history') return <ResourceHistoryPanel resource={resource} runtime={runtime} />
  throw new TypeError(`${panel} panel is unavailable`)
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

type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; entries: ReadonlyArray<ResourceHistoryEntry> }
  | { status: 'error' }

function ResourceHistoryPanel({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  useEffect(() => {
    let current = true
    if (runtime.history.status !== 'available') return
    void runtime.history.value
      .list(resource.id)
      .then((entries) => current && setState({ status: 'ready', entries }))
      .catch(() => current && setState({ status: 'error' }))
    return () => {
      current = false
    }
  }, [resource.id, runtime.history])

  if (state.status === 'loading') {
    return <p className="p-3 text-sm text-muted-foreground">Loading history…</p>
  }
  if (state.status === 'error') {
    return <p className="p-3 text-sm text-destructive">Could not load history.</p>
  }
  if (state.entries.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No history yet.</p>
  }
  return (
    <div className="p-3">
      <h2 className="mb-3 text-sm font-medium">History</h2>
      <ol className="space-y-3">
        {state.entries.map((entry) => (
          <li key={entry.id} className="border-l border-border pl-3 text-xs">
            <p>Resource updated</p>
            <p className="mt-0.5 text-muted-foreground">
              {formatResourceTimestamp(entry.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
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

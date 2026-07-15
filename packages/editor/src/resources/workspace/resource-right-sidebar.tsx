import { useEffect, useState } from 'react'
import { Clock3, FileText, Link2, List, X } from 'lucide-react'
import type { EditorRuntime, ResourceHistoryEntry } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { copyWorkspaceResourceLink } from './resource-operations'
import type { WorkspaceReport } from './resource-operations'

type PanelId = 'details' | 'outline' | 'backlinks' | 'outgoing' | 'history'

export function ResourceRightSidebar({
  activePanel,
  onActivePanelChange,
  onClose,
  onReport,
  resource,
  runtime,
}: {
  activePanel: PanelId
  onActivePanelChange: (panel: PanelId) => void
  onClose: () => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const panels = [
    { id: 'details' as const, label: 'Details', icon: FileText, available: true },
    { id: 'outline' as const, label: 'Outline', icon: List, available: false },
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
        {selected.id === 'details' ? (
          <ResourceDetails resource={resource} runtime={runtime} onReport={onReport} />
        ) : (
          <ResourceHistoryPanel resource={resource} runtime={runtime} />
        )}
      </div>
    </aside>
  )
}

function ResourceDetails({
  onReport,
  resource,
  runtime,
}: {
  onReport: WorkspaceReport
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
      <button
        type="button"
        className="mt-4 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        onClick={() => void copyWorkspaceResourceLink(runtime, resource, onReport)}
      >
        Copy link
      </button>
    </div>
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

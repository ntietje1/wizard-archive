import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type { WizardEditorRuntime } from './editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceKnowledge,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import { canonicalizeResourceTitle, RESOURCE_KIND } from './resource-contract'
import type { ResourceKind } from './resource-contract'
import { sortAuthorizedResourceSummaries } from './workspace-resource-index'

export type ResourceShellSort = Readonly<{
  by: 'created' | 'title' | 'updated'
  direction: 'ascending' | 'descending'
}>

export function ResourceShell({
  ariaLabel,
  runtime,
  sidebarSlots,
  showSidebar = true,
  sort = { by: 'title', direction: 'ascending' },
  workspaceName,
}: {
  ariaLabel: string
  runtime: WizardEditorRuntime
  sidebarSlots?: Readonly<{
    bottomPanel?: ReactNode
    railEndControls?: ReactNode
    railStartControls?: ReactNode
  }>
  showSidebar?: boolean
  sort?: ResourceShellSort
  workspaceName: string | null
}) {
  const snapshot = useResourceSnapshot(runtime)
  const selectedResourceId = useResourceSelection(runtime)
  const [lifecycle, setLifecycle] = useState<'active' | 'trashed'>('active')
  const [message, setMessage] = useState<string | null>(null)
  const rootsQuery = { parentId: null, lifecycle } as const

  useEffect(() => {
    if (selectedResourceId) void runtime.resources.loader.ensureResource(selectedResourceId)
  }, [runtime, selectedResourceId])

  const selected = selectedResourceId
    ? snapshot.lookup(selectedResourceId)
    : ({ state: 'unknown' } as const)

  return (
    <section aria-label={ariaLabel} className="flex h-full min-h-0 bg-background text-foreground">
      {showSidebar && (
        <aside className="flex w-72 min-w-56 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border p-2">
            <div className="flex items-center gap-1">{sidebarSlots?.railStartControls}</div>
            <strong className="truncate px-2 text-sm">{workspaceName ?? 'Resources'}</strong>
            <div className="flex items-center gap-1">{sidebarSlots?.railEndControls}</div>
          </div>
          <ResourceCreateMenu runtime={runtime} parentId={null} onReport={setMessage} />
          <div className="flex border-b border-border p-1" aria-label="Resource lifecycle">
            {(['active', 'trashed'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={lifecycle === value}
                className="flex-1 rounded px-2 py-1 text-sm aria-pressed:bg-muted"
                onClick={() => setLifecycle(value)}
              >
                {value === 'active' ? 'Resources' : 'Trash'}
              </button>
            ))}
          </div>
          <nav aria-label="Resources" className="min-h-0 flex-1 overflow-auto p-2">
            <ResourceCollection
              runtime={runtime}
              snapshot={snapshot}
              query={rootsQuery}
              selectedResourceId={selectedResourceId}
              sort={sort}
            />
          </nav>
          {message && (
            <p className="border-t border-border p-2 text-xs text-muted-foreground">{message}</p>
          )}
          {sidebarSlots?.bottomPanel}
        </aside>
      )}
      <main className="min-w-0 flex-1 overflow-auto">
        <SelectedResource
          knowledge={selected}
          resourceId={selectedResourceId}
          runtime={runtime}
          onReport={setMessage}
        />
      </main>
    </section>
  )
}

function useResourceSnapshot(runtime: WizardEditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.resources.index.subscribe(listener),
    () => runtime.resources.index.getSnapshot(),
    () => runtime.resources.index.getSnapshot(),
  )
}

function useResourceSelection(runtime: WizardEditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.navigation.subscribe(listener),
    () => runtime.navigation.current(),
    () => runtime.navigation.current(),
  )
}

function useEnsureCollection(runtime: WizardEditorRuntime, query: ResourceCollectionQuery) {
  const { lifecycle, parentId } = query
  useEffect(() => {
    void runtime.resources.loader.ensureCollection({ parentId, lifecycle })
  }, [lifecycle, parentId, runtime])
}

function ResourceCollection({
  query,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  query: ResourceCollectionQuery
  runtime: WizardEditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: ResourceShellSort
}) {
  useEnsureCollection(runtime, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') return <CollectionState label="Loading resources…" />
  if (collection.items.length === 0 && collection.complete) {
    return <CollectionState label="No resources" />
  }

  const items = sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
  return (
    <ul className="space-y-0.5">
      {items.map((resource) => (
        <ResourceTreeRow
          key={resource.id}
          resource={resource}
          runtime={runtime}
          selectedResourceId={selectedResourceId}
          snapshot={snapshot}
          sort={sort}
        />
      ))}
      {!collection.complete && <CollectionState label="More resources may be available" />}
    </ul>
  )
}

function CollectionState({ label }: { label: string }) {
  return <li className="px-2 py-1 text-xs text-muted-foreground">{label}</li>
}

function ResourceTreeRow({
  resource,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  resource: AuthorizedResourceSummary
  runtime: WizardEditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: ResourceShellSort
}) {
  const [expanded, setExpanded] = useState(true)
  const childQuery = { parentId: resource.id, lifecycle: resource.lifecycle } as const
  const children = resource.kind === 'folder' ? snapshot.list(childQuery) : null
  const hasChildren = children?.state === 'known' && children.items.length > 0

  return (
    <li>
      <div className="flex min-w-0 items-center">
        {resource.kind === 'folder' ? (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${resource.title}`}
            className="w-6 shrink-0 text-xs text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {hasChildren ? (expanded ? '▾' : '▸') : '·'}
          </button>
        ) : (
          <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">·</span>
        )}
        <button
          type="button"
          aria-current={selectedResourceId === resource.id ? 'page' : undefined}
          className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm aria-[current=page]:bg-muted"
          onClick={() => runtime.navigation.open(resource.id)}
        >
          {resource.title}
          <span className="ml-1 text-xs text-muted-foreground">{resource.kind}</span>
        </button>
      </div>
      {resource.kind === 'folder' && expanded && (
        <div className="ml-4 border-l border-border pl-1">
          <ResourceCollection
            runtime={runtime}
            snapshot={snapshot}
            query={childQuery}
            selectedResourceId={selectedResourceId}
            sort={sort}
          />
        </div>
      )}
    </li>
  )
}

function ResourceCreateMenu({
  onReport,
  parentId,
  runtime,
}: {
  onReport: (message: string) => void
  parentId: ResourceId | null
  runtime: WizardEditorRuntime
}) {
  return (
    <div className="grid grid-cols-4 gap-1 border-b border-border p-2">
      {(
        [RESOURCE_KIND.note, RESOURCE_KIND.folder, RESOURCE_KIND.map, RESOURCE_KIND.canvas] as const
      ).map((kind) => (
        <button
          key={kind}
          type="button"
          className="rounded border border-border px-1 py-1 text-xs hover:bg-muted"
          onClick={() => void createResource(runtime, kind, parentId, onReport)}
        >
          {kind === 'note'
            ? 'Note'
            : kind === 'folder'
              ? 'Folder'
              : kind === 'map'
                ? 'Map'
                : 'Canvas'}
        </button>
      ))}
    </div>
  )
}

async function createResource(
  runtime: WizardEditorRuntime,
  kind: ResourceKind,
  parentId: ResourceId | null,
  report: (message: string) => void,
) {
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const envelope = {
    campaignId: runtime.scope.campaignId,
    operationId,
    command: {
      type: 'create' as const,
      resourceId,
      kind,
      parentId,
      title: canonicalizeResourceTitle(`Untitled ${kind}`),
      icon: null,
      color: null,
    },
  }
  const delivery =
    kind === 'note'
      ? await runtime.content.notes.create(
          {
            ...envelope,
            command: { ...envelope.command, kind: 'note' },
          },
          new Y.Doc(),
        )
      : await runtime.resources.structure.execute(envelope)
  if (delivery.status === 'received' && delivery.result.status === 'completed') {
    runtime.navigation.open(resourceId)
    report(`${kind} created`)
    return
  }
  report(deliveryMessage(delivery))
}

function deliveryMessage(
  delivery: Awaited<ReturnType<WizardEditorRuntime['resources']['structure']['execute']>>,
) {
  if (delivery.status === 'indeterminate')
    return 'Delivery is uncertain. Retry with the same operation.'
  if (delivery.status === 'not_committed') return `Not committed: ${delivery.reason}`
  return delivery.result.status === 'completed'
    ? 'Completed'
    : `${delivery.result.status}: ${delivery.result.reason}`
}

function SelectedResource({
  knowledge,
  onReport,
  resourceId,
  runtime,
}: {
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>
  onReport: (message: string) => void
  resourceId: ResourceId | null
  runtime: WizardEditorRuntime
}) {
  if (!resourceId) return <EmptySelection />
  if (knowledge.state === 'unknown') return <SurfaceState label="Loading resource…" />
  if (knowledge.state === 'missing') return <SurfaceState label="Resource not found" />
  const resource = knowledge.value
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{resource.title}</h1>
          <ResourceBreadcrumb resource={resource} runtime={runtime} />
        </div>
        <ResourceActions resource={resource} runtime={runtime} onReport={onReport} />
      </header>
      <ResourceContent resource={resource} runtime={runtime} />
    </div>
  )
}

function ResourceBreadcrumb({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: WizardEditorRuntime
}) {
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const values = ancestors.state === 'known' ? ancestors.value : []
  return (
    <p className="truncate text-xs text-muted-foreground">
      {[...values.map((ancestor) => ancestor.title), resource.title].join(' / ')}
    </p>
  )
}

function ResourceActions({
  onReport,
  resource,
  runtime,
}: {
  onReport: (message: string) => void
  resource: AuthorizedResourceSummary
  runtime: WizardEditorRuntime
}) {
  const command = resource.lifecycle === 'active' ? 'trash' : 'restore'
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className="rounded border border-border px-2 py-1 text-xs"
        onClick={() => void executeSingleResourceCommand(runtime, resource.id, command, onReport)}
      >
        {command === 'trash' ? 'Trash' : 'Restore'}
      </button>
      {resource.lifecycle === 'trashed' && (
        <button
          type="button"
          className="rounded border border-destructive px-2 py-1 text-xs text-destructive"
          onClick={() =>
            void executeSingleResourceCommand(runtime, resource.id, 'permanentlyDelete', onReport)
          }
        >
          Delete forever
        </button>
      )}
    </div>
  )
}

async function executeSingleResourceCommand(
  runtime: WizardEditorRuntime,
  resourceId: ResourceId,
  type: 'trash' | 'restore' | 'permanentlyDelete',
  report: (message: string) => void,
) {
  const delivery = await runtime.resources.structure.execute({
    campaignId: runtime.scope.campaignId,
    operationId: generateDomainId(DOMAIN_ID_KIND.operation),
    command: { type, resourceIds: [resourceId] },
  })
  report(deliveryMessage(delivery))
}

function ResourceContent({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: WizardEditorRuntime
}) {
  if (resource.kind === 'folder') {
    return <SurfaceState label="Folder" />
  }
  switch (resource.kind) {
    case 'note':
      return <NoteContent resourceId={resource.id} runtime={runtime} />
    case 'file':
      return <FileContent resourceId={resource.id} runtime={runtime} />
    case 'map':
      return <MapContent resourceId={resource.id} runtime={runtime} />
    case 'canvas':
      return <CanvasContent resourceId={resource.id} runtime={runtime} />
  }
}

function NoteContent({ resourceId, runtime }: ContentProps) {
  const state = runtime.content.notes.get(resourceId)
  if (state.status === 'initializing') return <NoteSurface document={state.local} />
  if (state.status === 'ready') return <NoteSurface document={state.content} />
  return unavailableContentState(state)
}

function FileContent({ resourceId, runtime }: ContentProps) {
  const state = runtime.content.files.get(resourceId)
  const unavailable = unavailableContentState(state)
  if (unavailable || state.status !== 'ready') return unavailable
  return (
    <SurfaceState
      label={`${state.content.detectedFormat ?? state.content.mediaType} · ${state.content.byteSize} bytes`}
    />
  )
}

function MapContent({ resourceId, runtime }: ContentProps) {
  const state = runtime.content.maps.get(resourceId)
  const unavailable = unavailableContentState(state)
  if (unavailable || state.status !== 'ready') return unavailable
  return <SurfaceState label={`Map · ${state.content.pins.length} pins`} />
}

function CanvasContent({ resourceId, runtime }: ContentProps) {
  const state = runtime.content.canvases.get(resourceId)
  const unavailable = unavailableContentState(state)
  if (unavailable || state.status !== 'ready') return unavailable
  return <SurfaceState label="Canvas" />
}

type ContentProps = Readonly<{ resourceId: ResourceId; runtime: WizardEditorRuntime }>

function unavailableContentState(
  state:
    | ReturnType<WizardEditorRuntime['content']['notes']['get']>
    | ReturnType<WizardEditorRuntime['content']['files']['get']>
    | ReturnType<WizardEditorRuntime['content']['maps']['get']>
    | ReturnType<WizardEditorRuntime['content']['canvases']['get']>,
) {
  switch (state.status) {
    case 'loading':
      return <SurfaceState label="Loading content…" />
    case 'initializing':
      return <SurfaceState label="Initializing content…" />
    case 'unavailable':
      return <SurfaceState label={`Unavailable: ${state.reason}`} />
    case 'integrity_error':
      return <SurfaceState label={`Content integrity error: ${state.issue}`} />
    case 'ready':
      return null
  }
}

function NoteSurface({ document }: { document: Y.Doc }) {
  const text = document.getText('body')
  const value = useSyncExternalStore(
    (listener) => {
      text.observe(listener)
      return () => text.unobserve(listener)
    },
    () => text.toJSON(),
    () => text.toJSON(),
  )
  return (
    <textarea
      aria-label="Note content"
      className="min-h-[28rem] w-full resize-none bg-transparent p-6 outline-none"
      value={value}
      onChange={(event) => {
        document.transact(() => {
          text.delete(0, text.length)
          text.insert(0, event.target.value)
        })
      }}
    />
  )
}

function EmptySelection() {
  return <SurfaceState label="Select a resource" />
}

function SurfaceState({ label }: { label: string }) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

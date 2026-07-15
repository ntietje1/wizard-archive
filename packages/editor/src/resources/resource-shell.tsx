import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type { EditorRuntime } from './editor-runtime-contract'
import type {
  CommandDelivery,
  ResourceStructureCommand,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type {
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceKnowledge,
  ResourceLoadResult,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import { canonicalizeResourceTitle, RESOURCE_KIND } from './resource-record'
import type { ResourceKind } from './resource-record'
import { sortAuthorizedResourceSummaries } from './workspace-resource-index'

export type ResourceSort = Readonly<{
  by: 'created' | 'title' | 'updated'
  direction: 'ascending' | 'descending'
}>

type Report = (message: string, retry?: () => void) => void

export function ResourceShell({
  ariaLabel,
  runtime,
  resourcePanelSlots,
  showResourcePanel = true,
  sort = { by: 'title', direction: 'ascending' },
  workspaceName,
}: {
  ariaLabel: string
  runtime: EditorRuntime
  resourcePanelSlots?: Readonly<{
    footer?: ReactNode
    headerEnd?: ReactNode
    headerStart?: ReactNode
  }>
  showResourcePanel?: boolean
  sort?: ResourceSort
  workspaceName: string | null
}) {
  const snapshot = useResourceSnapshot(runtime)
  const selectedResourceId = useResourceSelection(runtime)
  const [lifecycle, setLifecycle] = useState<'active' | 'trashed'>('active')
  const [notice, setNotice] = useState<{ message: string; retry?: () => void } | null>(null)
  const report: Report = (message, retry) => setNotice({ message, ...(retry ? { retry } : {}) })
  const rootsQuery = { parentId: null, lifecycle } as const
  const selectedLoad = useEnsureResource(runtime, selectedResourceId)

  const selected = selectedResourceId
    ? snapshot.lookup(selectedResourceId)
    : ({ state: 'unknown' } as const)

  return (
    <section
      aria-label={ariaLabel}
      className="flex h-full min-h-0 flex-col bg-background text-foreground sm:flex-row"
    >
      {showResourcePanel && (
        <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-border sm:max-h-none sm:w-72 sm:min-w-56 sm:border-r sm:border-b-0">
          <div className="flex items-center justify-between border-b border-border p-2">
            <div className="flex items-center gap-1">{resourcePanelSlots?.headerStart}</div>
            <strong className="truncate px-2 text-sm">{workspaceName ?? 'Resources'}</strong>
            <div className="flex items-center gap-1">{resourcePanelSlots?.headerEnd}</div>
          </div>
          {runtime.resources.structure.status === 'available' && (
            <ResourceCreateMenu runtime={runtime} parentId={null} onReport={report} />
          )}
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
          {notice && (
            <p className="border-t border-border p-2 text-xs text-muted-foreground">
              {notice.message}{' '}
              {notice.retry && (
                <button type="button" className="underline" onClick={notice.retry}>
                  Retry
                </button>
              )}
            </p>
          )}
          {resourcePanelSlots?.footer}
        </aside>
      )}
      <main className="min-w-0 flex-1 overflow-auto">
        <SelectedResource
          knowledge={selected}
          load={selectedLoad}
          resourceId={selectedResourceId}
          runtime={runtime}
          onReport={report}
        />
      </main>
    </section>
  )
}

function useResourceSnapshot(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.resources.index.subscribe(listener),
    () => runtime.resources.index.getSnapshot(),
    () => runtime.resources.index.getSnapshot(),
  )
}

function useResourceSelection(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.navigation.subscribe(listener),
    () => runtime.navigation.current(),
    () => runtime.navigation.current(),
  )
}

function useEnsureCollection(runtime: EditorRuntime, query: ResourceCollectionQuery) {
  const { lifecycle, parentId } = query
  const [attempt, setAttempt] = useState(0)
  const key = `${parentId ?? 'root'}:${lifecycle}:${attempt}`
  const [loaded, setLoaded] = useState<{ key: string; result: ResourceLoadResult } | null>(null)
  useEffect(() => {
    let current = true
    void runtime.resources.loader
      .ensureCollection({ parentId, lifecycle })
      .then((result) => current && setLoaded({ key, result }))
    return () => {
      current = false
    }
  }, [key, lifecycle, parentId, runtime])
  return {
    result: loaded?.key === key ? loaded.result : null,
    retry: () => setAttempt((value) => value + 1),
  }
}

function useEnsureResource(runtime: EditorRuntime, resourceId: ResourceId | null) {
  const [attempt, setAttempt] = useState(0)
  const key = `${resourceId ?? 'none'}:${attempt}`
  const [loaded, setLoaded] = useState<{ key: string; result: ResourceLoadResult } | null>(null)
  useEffect(() => {
    let current = true
    if (resourceId) {
      void runtime.resources.loader
        .ensureResource(resourceId)
        .then((result) => current && setLoaded({ key, result }))
    }
    return () => {
      current = false
    }
  }, [key, resourceId, runtime])
  return {
    result: loaded?.key === key ? loaded.result : null,
    retry: () => setAttempt((value) => value + 1),
  }
}

function ResourceCollection({
  query,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  query: ResourceCollectionQuery
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: ResourceSort
}) {
  const load = useEnsureCollection(runtime, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') {
    return (
      <ul>
        <CollectionState>
          <ResourceLoadState load={load} pendingLabel="Loading resources…" />
        </CollectionState>
      </ul>
    )
  }
  if (collection.items.length === 0 && collection.complete) {
    return (
      <ul>
        <CollectionState label="No resources" />
      </ul>
    )
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

function CollectionState({ children, label }: { children?: ReactNode; label?: string }) {
  return <li className="px-2 py-1 text-xs text-muted-foreground">{children ?? label}</li>
}

function ResourceLoadState({
  load,
  pendingLabel,
}: {
  load: { result: ResourceLoadResult | null; retry: () => void }
  pendingLabel: string
}) {
  const result = load.result
  if (!result) return pendingLabel
  if (result.status === 'completed') return 'Waiting for authorized data…'
  if (result.status === 'scope_changed') return 'Resource scope changed'
  if (result.status === 'unavailable') return `Unavailable: ${result.reason}`
  return (
    <span>
      {result.retryable ? 'Could not load.' : `Could not load: ${result.reason}.`}{' '}
      {result.retryable && (
        <button type="button" className="underline" onClick={load.retry}>
          Retry
        </button>
      )}
    </span>
  )
}

function ResourceTreeRow({
  resource,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: ResourceSort
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
  onReport: Report
  parentId: ResourceId | null
  runtime: EditorRuntime
}) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('')
  return (
    <div className="space-y-1 border-b border-border p-2">
      <input
        aria-label="New resource title"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
        placeholder="Optional title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="grid grid-cols-2 gap-1">
        <input
          aria-label="New resource icon"
          className="min-w-0 rounded border border-border bg-background px-2 py-1 text-xs"
          placeholder="Optional icon"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
        />
        <input
          aria-label="New resource color"
          className="min-w-0 rounded border border-border bg-background px-2 py-1 text-xs"
          placeholder="Optional color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {(
          [
            RESOURCE_KIND.note,
            RESOURCE_KIND.folder,
            RESOURCE_KIND.map,
            RESOURCE_KIND.canvas,
          ] as const
        ).map((kind) => (
          <button
            key={kind}
            type="button"
            className="rounded border border-border px-1 py-1 text-xs hover:bg-muted"
            onClick={() =>
              void createResource(runtime, kind, parentId, { title, icon, color }, onReport)
            }
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
    </div>
  )
}

async function createResource(
  runtime: EditorRuntime,
  kind: ResourceKind,
  parentId: ResourceId | null,
  metadata: { title: string; icon: string; color: string },
  report: Report,
) {
  if (runtime.resources.structure.status !== 'available') {
    report('Unavailable: unauthorized')
    return
  }
  const structure = runtime.resources.structure.value
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const local = kind === 'note' ? new Y.Doc() : null
  const envelope = {
    campaignId: runtime.scope.campaignId,
    operationId,
    command: {
      type: 'create' as const,
      resourceId,
      kind,
      parentId,
      title: canonicalizeResourceTitle(metadata.title || `Untitled ${kind}`),
      icon: metadata.icon || null,
      color: metadata.color || null,
    },
  }
  const attempt = async (): Promise<void> => {
    const delivery =
      kind === 'note'
        ? await runtime.content.notes.create(
            {
              ...envelope,
              command: { ...envelope.command, kind: 'note' },
            },
            local!,
          )
        : await structure.execute(envelope)
    if (delivery.status === 'indeterminate') {
      report(deliveryMessage(delivery), () => void attempt())
      return
    }
    if (delivery.status === 'received' && delivery.result.status === 'completed') {
      runtime.navigation.open(resourceId)
      report(`${kind} created`)
      return
    }
    report(deliveryMessage(delivery))
  }
  await attempt()
}

function deliveryMessage(delivery: CommandDelivery<ResourceStructureCommandResult>) {
  if (delivery.status === 'indeterminate')
    return 'Delivery is uncertain. Retry with the same operation.'
  if (delivery.status === 'not_committed') return `Not committed: ${delivery.reason}`
  return delivery.result.status === 'completed'
    ? 'Completed'
    : `${delivery.result.status}: ${delivery.result.reason}`
}

function SelectedResource({
  knowledge,
  load,
  onReport,
  resourceId,
  runtime,
}: {
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>
  load: { result: ResourceLoadResult | null; retry: () => void }
  onReport: Report
  resourceId: ResourceId | null
  runtime: EditorRuntime
}) {
  if (!resourceId) return <EmptySelection />
  if (knowledge.state === 'unknown') {
    return (
      <SurfaceState>
        <ResourceLoadState load={load} pendingLabel="Loading resource…" />
      </SurfaceState>
    )
  }
  if (knowledge.state === 'missing') return <SurfaceState label="Resource not found" />
  const resource = knowledge.value
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{resource.title}</h1>
          <ResourceBreadcrumb resource={resource} runtime={runtime} />
          <ResourceCapabilitySummary resourceId={resource.id} runtime={runtime} />
        </div>
        <ResourceActions resource={resource} runtime={runtime} onReport={onReport} />
      </header>
      <ResourceContent resource={resource} runtime={runtime} />
      <ResourceDetails resource={resource} runtime={runtime} onReport={onReport} />
    </div>
  )
}

function ResourceBreadcrumb({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const values = ancestors.state === 'known' ? ancestors.value : []
  return (
    <p className="truncate text-xs text-muted-foreground">
      {[...values.map((ancestor) => ancestor.title), resource.title].join(' / ')}
    </p>
  )
}

function ResourceCapabilitySummary({
  resourceId,
  runtime,
}: {
  resourceId: ResourceId
  runtime: EditorRuntime
}) {
  const accessCapability = runtime.resources.access
  const bookmarkCapability = runtime.resources.bookmarks
  const previewCapability = runtime.resources.previews
  const access = useSyncExternalStore(
    (listener) =>
      accessCapability.status === 'available'
        ? accessCapability.value.subscribe(resourceId, listener)
        : () => undefined,
    () => (accessCapability.status === 'available' ? accessCapability.value.get(resourceId) : null),
    () => null,
  )
  const bookmark = useSyncExternalStore(
    (listener) =>
      bookmarkCapability.status === 'available'
        ? bookmarkCapability.value.subscribe(resourceId, listener)
        : () => undefined,
    () =>
      bookmarkCapability.status === 'available' ? bookmarkCapability.value.get(resourceId) : null,
    () => null,
  )
  const preview = useSyncExternalStore(
    (listener) =>
      previewCapability.status === 'available'
        ? previewCapability.value.subscribe(resourceId, listener)
        : () => undefined,
    () =>
      previewCapability.status === 'available' ? previewCapability.value.get(resourceId) : null,
    () => null,
  )
  const values = [
    runtime.resources.structure.status === 'available' ? 'Editable' : 'Read only',
    access?.state === 'known' ? `Access: ${access.value}` : null,
    bookmark?.state === 'known' && bookmark.value ? 'Bookmarked' : null,
    preview?.state === 'known' && preview.value ? 'Preview available' : null,
  ].filter((value): value is string => value !== null)
  return <p className="truncate text-xs text-muted-foreground">{values.join(' · ')}</p>
}

function ResourceDetails({
  onReport,
  resource,
  runtime,
}: {
  onReport: Report
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  return (
    <details className="border-t border-border p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer">Details</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>Kind</dt>
        <dd>{resource.kind}</dd>
        <dt>Location</dt>
        <dd>{resource.displayParentId ? 'Visible folder' : 'Campaign root'}</dd>
        <dt>Lifecycle</dt>
        <dd>{resource.lifecycle}</dd>
        <dt>Created</dt>
        <dd>{new Date(resource.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(resource.updatedAt).toLocaleString()}</dd>
        <dt>Resource ID</dt>
        <dd className="break-all font-mono">{resource.id}</dd>
      </dl>
      <button
        type="button"
        className="mt-2 rounded border border-border px-2 py-1"
        onClick={() => void copyResourceLink(runtime, resource, onReport)}
      >
        Copy link
      </button>
    </details>
  )
}

async function copyResourceLink(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: Report,
) {
  if (resource.campaignId !== runtime.scope.campaignId) {
    report('Cannot link a resource from another campaign')
    return
  }
  if (!globalThis.navigator?.clipboard) {
    report('Copy link is unavailable')
    return
  }
  const url = new URL(
    `/campaigns/${runtime.scope.campaignId}/editor?resource=${resource.id}`,
    globalThis.location?.origin ?? 'https://wizard-archive.invalid',
  )
  await navigator.clipboard.writeText(url.href)
  report('Link copied')
}

function ResourceActions({
  onReport,
  resource,
  runtime,
}: {
  onReport: Report
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (runtime.resources.structure.status !== 'available') return null
  const command = resource.lifecycle === 'active' ? 'trash' : 'restore'
  if (editing) {
    return (
      <ResourceMetadataForm
        resource={resource}
        runtime={runtime}
        onCancel={() => setEditing(false)}
        onReport={onReport}
      />
    )
  }
  return (
    <div className="flex gap-1">
      {resource.lifecycle === 'active' && (
        <>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={() => setEditing(true)}
          >
            Edit details
          </button>
          {resource.displayParentId !== null && (
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => void moveResourceToRoot(runtime, resource.id, onReport)}
            >
              Move to root
            </button>
          )}
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs"
            onClick={() => void duplicateResource(runtime, resource, onReport)}
          >
            Duplicate
          </button>
        </>
      )}
      <button
        type="button"
        aria-label={
          command === 'trash' ? `Move ${resource.title} to trash` : `Restore ${resource.title}`
        }
        className="rounded border border-border px-2 py-1 text-xs"
        onClick={() => void executeSingleResourceCommand(runtime, resource.id, command, onReport)}
      >
        {command === 'trash' ? 'Trash' : 'Restore'}
      </button>
      {resource.lifecycle === 'trashed' &&
        (confirmDelete ? (
          <>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-label={`Confirm delete ${resource.title} forever`}
              className="rounded border border-destructive px-2 py-1 text-xs text-destructive"
              onClick={() =>
                void executeSingleResourceCommand(
                  runtime,
                  resource.id,
                  'permanentlyDelete',
                  onReport,
                )
              }
            >
              Confirm delete
            </button>
          </>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${resource.title} forever`}
            className="rounded border border-destructive px-2 py-1 text-xs text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete forever
          </button>
        ))}
    </div>
  )
}

function ResourceMetadataForm({
  onCancel,
  onReport,
  resource,
  runtime,
}: {
  onCancel: () => void
  onReport: Report
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [title, setTitle] = useState<string>(resource.title)
  const [icon, setIcon] = useState(resource.icon ?? '')
  const [color, setColor] = useState(resource.color ?? '')
  return (
    <form
      className="flex max-w-xl flex-wrap justify-end gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        void updateResourceMetadata(runtime, resource.id, { title, icon, color }, onReport).then(
          (completed) => completed && onCancel(),
        )
      }}
    >
      <input
        aria-label="Resource title"
        className="min-w-40 rounded border border-border bg-background px-2 py-1 text-xs"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        aria-label="Resource icon"
        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
        placeholder="Icon"
        value={icon}
        onChange={(event) => setIcon(event.target.value)}
      />
      <input
        aria-label="Resource color"
        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
        placeholder="Color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
      />
      <button
        type="button"
        className="rounded border border-border px-2 py-1 text-xs"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button type="submit" className="rounded border border-border px-2 py-1 text-xs">
        Save
      </button>
    </form>
  )
}

async function updateResourceMetadata(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  values: { title: string; icon: string; color: string },
  report: Report,
) {
  let title
  try {
    title = canonicalizeResourceTitle(values.title)
  } catch {
    report('Invalid resource title')
    return false
  }
  return await executeRetryableStructureCommand(
    runtime,
    {
      type: 'updateMetadata',
      resourceId,
      changes: {
        title,
        icon: values.icon || null,
        color: values.color || null,
      },
    },
    report,
  )
}

async function moveResourceToRoot(runtime: EditorRuntime, resourceId: ResourceId, report: Report) {
  await executeRetryableStructureCommand(
    runtime,
    {
      type: 'move',
      resourceIds: [resourceId],
      destinationParentId: null,
    },
    report,
  )
}

async function executeSingleResourceCommand(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  type: 'trash' | 'restore' | 'permanentlyDelete',
  report: Report,
) {
  await executeRetryableStructureCommand(runtime, { type, resourceIds: [resourceId] }, report)
}

async function duplicateResource(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: Report,
) {
  await executeRetryableStructureCommand(
    runtime,
    {
      type: 'deepCopy',
      sourceRootIds: [resource.id],
      destinationParentId: resource.displayParentId,
    },
    report,
    (delivery) => {
      if (
        delivery.status === 'received' &&
        delivery.result.status === 'completed' &&
        delivery.result.receipt.result.type === 'deepCopied'
      ) {
        const destinationId = delivery.result.receipt.result.roots[0]?.destinationRootId
        if (destinationId) runtime.navigation.open(destinationId)
        report('Resource duplicated')
        return
      }
      report(deliveryMessage(delivery))
    },
  )
}

async function executeRetryableStructureCommand(
  runtime: EditorRuntime,
  command: ResourceStructureCommand,
  report: Report,
  handle: (delivery: CommandDelivery<ResourceStructureCommandResult>) => void = (delivery) =>
    report(deliveryMessage(delivery)),
) {
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const attempt = async (): Promise<boolean> => {
    const delivery = await deliverStructureCommand(runtime, command, operationId)
    if (!delivery) {
      report('Unavailable: unauthorized')
      return false
    }
    if (delivery.status === 'indeterminate') {
      report(deliveryMessage(delivery), () => void attempt())
      return false
    }
    handle(delivery)
    return delivery.status === 'received' && delivery.result.status === 'completed'
  }
  return await attempt()
}

function availableStructure(runtime: EditorRuntime): ResourceStructureCommandGateway | null {
  return runtime.resources.structure.status === 'available'
    ? runtime.resources.structure.value
    : null
}

function deliverStructureCommand(
  runtime: EditorRuntime,
  command: ResourceStructureCommand,
  operationId = generateDomainId(DOMAIN_ID_KIND.operation),
): Promise<CommandDelivery<ResourceStructureCommandResult>> | null {
  const structure = availableStructure(runtime)
  return (
    structure?.execute({
      campaignId: runtime.scope.campaignId,
      operationId,
      command,
    }) ?? null
  )
}

function ResourceContent({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
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
  if (state.status === 'ready') return <NoteSurface document={state.session.document} />
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
  return <SurfaceState label={`Map · ${state.session.content.pins.length} pins`} />
}

function CanvasContent({ resourceId, runtime }: ContentProps) {
  const state = runtime.content.canvases.get(resourceId)
  const unavailable = unavailableContentState(state)
  if (unavailable || state.status !== 'ready') return unavailable
  return <SurfaceState label="Canvas" />
}

type ContentProps = Readonly<{ resourceId: ResourceId; runtime: EditorRuntime }>

function unavailableContentState(
  state:
    | ReturnType<EditorRuntime['content']['notes']['get']>
    | ReturnType<EditorRuntime['content']['files']['get']>
    | ReturnType<EditorRuntime['content']['maps']['get']>
    | ReturnType<EditorRuntime['content']['canvases']['get']>,
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

function SurfaceState({ children, label }: { children?: ReactNode; label?: string }) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      {children ?? label}
    </div>
  )
}

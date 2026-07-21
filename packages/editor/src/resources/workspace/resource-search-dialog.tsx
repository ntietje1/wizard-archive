import { useEffect, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Folder, Loader2, PanelRight, Search, X } from 'lucide-react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime, WorkspaceSearch } from '../editor-runtime-contract'
import type { WorkspaceSearchResult } from '../resource-search-policy'
import type {
  AuthorizedResourceSummary,
  ResourceKnowledge,
  WorkspaceResourceIndexSnapshot,
} from '../resource-index-contract'
import { planProjectedResourceStructureCommand } from '../resource-projected-structure-plan'
import type { ResourceKind } from '../resource-record'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-icon'
import { useEnsureResourceCollection } from './resource-loading'
import { useModalDialog } from './use-modal-dialog'
import { useResourceSnapshot } from './use-resource-snapshot'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'
import { EmbeddedResourceSurface } from './embedded-resource-surface'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'

type SearchState =
  | Readonly<{ status: 'idle'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'searching'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'ready'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'incomplete'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'failed'; results: ReadonlyArray<WorkspaceSearchResult> }>

type SearchDisplayItem =
  | Readonly<{ type: 'create'; kind: Exclude<ResourceKind, 'file'> }>
  | Readonly<{ type: 'root' }>
  | Readonly<{ type: 'resource'; result: WorkspaceSearchResult }>

const EMPTY_RESULTS: ReadonlyArray<WorkspaceSearchResult> = []
const ROOT_FOLDER_QUERY = {
  parentId: null,
  lifecycle: 'active' as const,
  kinds: ['folder' as const],
}

type ResourceSearchPurpose =
  | Readonly<{ type: 'open' }>
  | Readonly<{ type: 'move'; resourceIds: ReadonlyArray<ResourceId> }>

export function ResourceSearchDialog({
  actions,
  canEdit,
  onOpenChange,
  open,
  purpose = { type: 'open' },
  runtime,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  purpose?: ResourceSearchPurpose
  runtime: EditorRuntime
}) {
  const search = runtime.search.status === 'available' ? runtime.search.value : null
  if (!search || !open) return null
  return (
    <OpenResourceSearchDialog
      actions={actions}
      canEdit={canEdit}
      purpose={purpose}
      runtime={runtime}
      search={search}
      onOpenChange={onOpenChange}
    />
  )
}

function OpenResourceSearchDialog({
  actions,
  canEdit,
  onOpenChange,
  purpose,
  runtime,
  search,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  purpose: ResourceSearchPurpose
  runtime: EditorRuntime
  search: WorkspaceSearch
}) {
  const snapshot = useResourceSnapshot(runtime)
  const recent = useSyncExternalStore(
    (listener) => search.subscribeRecent(listener),
    () => search.recent(),
    () => search.recent(),
  )
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle', results: EMPTY_RESULTS })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [moving, setMoving] = useState(false)
  const dialogRef = useModalDialog()
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, null)
  useEnsureResourceCollection(runtime.resources.loader, ROOT_FOLDER_QUERY, purpose.type === 'move')

  useEffect(() => {
    void Promise.all(
      search.recent().map((resourceId) => runtime.resources.loader.ensureResource(resourceId)),
    )
  }, [runtime.resources.loader, search])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) return
    let active = true
    const timer = window.setTimeout(() => {
      setState((current) => ({ status: 'searching', results: current.results }))
      void search
        .search(normalized)
        .then((outcome) => {
          if (active) {
            setState({
              status: outcome.status === 'complete' ? 'ready' : 'incomplete',
              results: outcome.results,
            })
          }
        })
        .catch(() => {
          if (active) setState((current) => ({ status: 'failed', results: current.results }))
        })
    }, 120)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, search])

  const { displayItems, recentResults } = buildSearchDisplayItems({
    canEdit,
    purpose,
    query,
    recent,
    snapshot,
    state,
  })
  const selected = displayItems[selectedIndex] ?? null
  const selectedResource =
    selected?.type === 'resource'
      ? knownResource(snapshot.lookup(selected.result.resourceId))
      : null
  const select = async (item: SearchDisplayItem) => {
    if (purpose.type === 'move') {
      const destinationParentId = item.type === 'resource' ? item.result.resourceId : null
      if (
        item.type === 'create' ||
        !isEligibleMoveDestination(snapshot, purpose.resourceIds, destinationParentId)
      ) {
        return
      }
      setMoving(true)
      const completed = await actions.move(purpose.resourceIds, destinationParentId)
      setMoving(false)
      if (completed) onOpenChange(false)
      return
    }
    if (item.type === 'create') {
      const settlement = await creation.run(item.kind, (signal) =>
        actions.create(item.kind, null, '', signal),
      )
      if (settlement.status === 'completed') onOpenChange(false)
      return
    }
    if (item.type === 'root') return
    search.recordOpened(item.result.resourceId)
    actions.open(item.result.resourceId)
    onOpenChange(false)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (displayItems.length === 0) return
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setSelectedIndex((index) => (index + direction + displayItems.length) % displayItems.length)
      return
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault()
      void select(selected)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-describedby="resource-search-description"
      aria-labelledby="resource-search-title"
      className={`${purpose.type === 'open' && showPreview ? 'max-w-4xl' : 'max-w-xl'} m-auto h-[min(80vh,600px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/40 open:flex`}
      onCancel={(event) => {
        event.preventDefault()
        onOpenChange(false)
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <h2 id="resource-search-title" className="sr-only">
        {purpose.type === 'move' ? 'Move resources' : 'Search'}
      </h2>
      <p id="resource-search-description" className="sr-only">
        {purpose.type === 'move' ? 'Choose a destination folder' : 'Search your vault'}
      </p>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          aria-activedescendant={
            displayItems.length > 0 ? `resource-search-${selectedIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls="resource-search-results"
          aria-expanded={displayItems.length > 0}
          aria-label={purpose.type === 'move' ? 'Search folders' : 'Search'}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={purpose.type === 'move' ? 'Search folders…' : 'Search…'}
          role="combobox"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
        />
        {purpose.type === 'open' && (
          <button
            type="button"
            aria-label="Toggle preview"
            aria-pressed={showPreview}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setShowPreview((value) => !value)}
          >
            <PanelRight className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <WorkspaceCreationStatus creation={creation} onCompleted={() => onOpenChange(false)} />
      <div className="flex min-h-0 flex-1">
        <div
          className={`${showPreview ? 'w-1/2 border-r border-border' : 'w-full'} flex min-h-0 flex-col`}
        >
          <output
            aria-live="polite"
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {searchStatus(query, state, displayItems.length, recentResults.length)}
          </output>
          <ScrollArea className="min-h-0 flex-1">
            <div
              id="resource-search-results"
              role="listbox"
              aria-label="Search results"
              className="p-1"
            >
              {displayItems.map((item, index) => (
                <SearchItem
                  key={
                    item.type === 'create'
                      ? `create-${item.kind}`
                      : item.type === 'root'
                        ? 'workspace-root'
                        : item.result.resourceId
                  }
                  id={`resource-search-${index}`}
                  item={item}
                  disabled={item.type === 'create' && creation.blocked}
                  moveDisabled={
                    purpose.type === 'move' &&
                    !isEligibleMoveDestination(
                      snapshot,
                      purpose.resourceIds,
                      item.type === 'resource' ? item.result.resourceId : null,
                    )
                  }
                  moving={moving}
                  pending={item.type === 'create' && creation.pendingControlId === item.kind}
                  query={query}
                  resource={
                    item.type === 'resource'
                      ? knownResource(snapshot.lookup(item.result.resourceId))
                      : null
                  }
                  selected={index === selectedIndex}
                  onActivate={() => void select(item)}
                  onHover={() => setSelectedIndex(index)}
                />
              ))}
              {displayItems.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? 'No results found' : 'Type to search your vault'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        {purpose.type === 'open' && showPreview && (
          <SearchPreview resource={selectedResource} runtime={runtime} />
        )}
      </div>
      <div className="flex gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span>↑↓ Navigate</span>
        <span>↵ {purpose.type === 'move' ? 'Move' : 'Open / Run'}</span>
        <span>Esc Close</span>
      </div>
    </dialog>
  )
}

function SearchItem({
  disabled,
  id,
  item,
  onActivate,
  onHover,
  pending,
  moveDisabled,
  moving,
  query,
  resource,
  selected,
}: {
  disabled: boolean
  id: string
  item: SearchDisplayItem
  onActivate: () => void
  onHover: () => void
  pending: boolean
  moveDisabled: boolean
  moving: boolean
  query: string
  resource: AuthorizedResourceSummary | null
  selected: boolean
}) {
  const { Icon, subtitle, title } = searchItemPresentation(item, resource)
  return (
    <button
      id={id}
      role="option"
      type="button"
      aria-selected={selected}
      aria-busy={pending || moving}
      disabled={disabled || moveDisabled || moving}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted aria-selected:bg-muted"
      onClick={onActivate}
      onMouseEnter={onHover}
    >
      {pending || (moving && selected) ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{highlight(title, query)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {highlight(subtitle, query)}
        </span>
      </span>
    </button>
  )
}

function searchItemPresentation(
  item: SearchDisplayItem,
  resource: AuthorizedResourceSummary | null,
) {
  switch (item.type) {
    case 'root':
      return { Icon: Folder, subtitle: 'Campaign root', title: 'Workspace root' }
    case 'create':
      return {
        Icon: resourceKindIcon(item.kind),
        subtitle: 'Create at workspace root',
        title: `New ${resourceKindLabel(item.kind)}`,
      }
    case 'resource':
      return {
        Icon: resource ? resourceKindIcon(resource.kind) : Search,
        subtitle:
          item.result.match.type === 'body'
            ? item.result.match.text
            : resource
              ? resourceKindLabel(resource.kind)
              : '',
        title: resource?.title ?? 'Loading…',
      }
  }
}

function SearchPreview({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary | null
  runtime: EditorRuntime
}) {
  if (!resource) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a result to preview
      </div>
    )
  }
  return (
    <div className="flex w-1/2 min-h-0 flex-col">
      <div className="border-b border-border p-4">
        <h3 className="truncate font-medium">{resource.title}</h3>
        <p className="text-sm text-muted-foreground">{resourceKindLabel(resource.kind)}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <EmbeddedResourceSurface resource={resource} runtime={runtime} />
      </div>
    </div>
  )
}

function matchingCreateCommands(query: string, canEdit: boolean): ReadonlyArray<SearchDisplayItem> {
  if (!canEdit) return []
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return (['note', 'folder', 'map', 'canvas'] as const).flatMap((kind) => {
    const text = `new ${kind} create ${kind}`
    return terms.every((term) => text.includes(term)) ? [{ type: 'create' as const, kind }] : []
  })
}

function buildSearchDisplayItems({
  canEdit,
  purpose,
  query,
  recent,
  snapshot,
  state,
}: {
  canEdit: boolean
  purpose: ResourceSearchPurpose
  query: string
  recent: ReadonlyArray<ResourceId>
  snapshot: WorkspaceResourceIndexSnapshot
  state: SearchState
}) {
  const recentResults = recent.flatMap((resourceId) => {
    const resource = knownResource(snapshot.lookup(resourceId))
    return resource && (purpose.type === 'open' || resource.kind === 'folder')
      ? [{ resourceId, match: { type: 'title' as const } }]
      : []
  })
  const searching = query.trim().length > 0
  const searchResults = (searching ? state.results : recentResults).filter((result) => {
    const resource = knownResource(snapshot.lookup(result.resourceId))
    return purpose.type === 'open' || resource?.kind === 'folder'
  })
  const rootFolders = snapshot.list(ROOT_FOLDER_QUERY)
  const browsableFolders =
    purpose.type === 'move' && !searching && rootFolders.state === 'known'
      ? rootFolders.items.map((resource) => ({
          resourceId: resource.id,
          match: { type: 'title' as const },
        }))
      : []
  const resources = uniqueSearchResults([...browsableFolders, ...searchResults]).map((result) => ({
    type: 'resource' as const,
    result,
  }))
  const destinations = purpose.type === 'move' ? ([{ type: 'root' }] as const) : []
  return {
    displayItems: [
      ...destinations,
      ...matchingCreateCommands(query, canEdit && purpose.type === 'open'),
      ...resources,
    ] satisfies ReadonlyArray<SearchDisplayItem>,
    recentResults,
  }
}

function uniqueSearchResults(
  results: ReadonlyArray<WorkspaceSearchResult>,
): ReadonlyArray<WorkspaceSearchResult> {
  const seen = new Set<ResourceId>()
  return results.filter((result) => {
    if (seen.has(result.resourceId)) return false
    seen.add(result.resourceId)
    return true
  })
}

function isEligibleMoveDestination(
  snapshot: WorkspaceResourceIndexSnapshot,
  resourceIds: ReadonlyArray<ResourceId>,
  destinationParentId: ResourceId | null,
): boolean {
  const result = planProjectedResourceStructureCommand(snapshot, {
    type: 'move',
    resourceIds,
    destinationParentId,
  })
  return (
    result.status === 'planned' &&
    result.plan.patches.some(({ before }) => before.parentId !== destinationParentId)
  )
}

function knownResource(
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>,
): AuthorizedResourceSummary | null {
  return knowledge.state === 'known' ? knowledge.value : null
}

function searchStatus(
  query: string,
  state: SearchState,
  displayCount: number,
  recentCount: number,
) {
  if (!query.trim()) return recentCount > 0 ? 'Recent' : ''
  if (state.status === 'searching') return 'Searching…'
  if (state.status === 'failed')
    return displayCount > 0 ? 'Search failed · showing previous results' : 'Search failed'
  if (state.status === 'incomplete')
    return displayCount > 0
      ? `${displayCount} ranked results · refine your search for complete results`
      : 'Too many matches · refine your search'
  return displayCount === 1 ? '1 result' : `${displayCount} results`
}

function highlight(text: string, query: string): ReactNode {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return text
  const index = text.toLocaleLowerCase().indexOf(normalized)
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200/60 text-inherit">
        {text.slice(index, index + normalized.length)}
      </mark>
      {text.slice(index + normalized.length)}
    </>
  )
}

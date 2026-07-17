import { useEffect, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Loader2, PanelRight, Search, X } from 'lucide-react'
import type { EditorRuntime, WorkspaceSearch } from '../editor-runtime-contract'
import type { WorkspaceSearchResult } from '../resource-search-policy'
import type { AuthorizedResourceSummary, ResourceKnowledge } from '../resource-index-contract'
import type { ResourceKind } from '../resource-record'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-presentation'
import { useModalDialog } from './use-modal-dialog'
import { useResourceSnapshot } from './use-resource-snapshot'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'

type SearchState =
  | Readonly<{ status: 'idle'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'searching'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'ready'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'incomplete'; results: ReadonlyArray<WorkspaceSearchResult> }>
  | Readonly<{ status: 'failed'; results: ReadonlyArray<WorkspaceSearchResult> }>

type SearchDisplayItem =
  | Readonly<{ type: 'create'; kind: Exclude<ResourceKind, 'file'> }>
  | Readonly<{ type: 'resource'; result: WorkspaceSearchResult }>

const EMPTY_RESULTS: ReadonlyArray<WorkspaceSearchResult> = []

export function ResourceSearchDialog({
  actions,
  canEdit,
  onOpenChange,
  open,
  runtime,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  runtime: EditorRuntime
}) {
  const search = runtime.search.status === 'available' ? runtime.search.value : null
  if (!search || !open) return null
  return (
    <OpenResourceSearchDialog
      actions={actions}
      canEdit={canEdit}
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
  runtime,
  search,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  runtime: EditorRuntime
  search: WorkspaceSearch
}) {
  const snapshot = useResourceSnapshot(runtime)
  const recent = useSyncExternalStore(
    (listener) => search?.subscribeRecent(listener) ?? (() => {}),
    () => search?.recent() ?? [],
    () => search?.recent() ?? [],
  )
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle', results: EMPTY_RESULTS })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const dialogRef = useModalDialog()
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, null)

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

  const recentResults = recent.flatMap((resourceId) =>
    snapshot.lookup(resourceId).state === 'known'
      ? [{ resourceId, match: { type: 'title' as const } }]
      : [],
  )
  const displayItems: ReadonlyArray<SearchDisplayItem> = [
    ...matchingCreateCommands(query, canEdit),
    ...(query.trim() ? state.results : recentResults).map((result) => ({
      type: 'resource' as const,
      result,
    })),
  ]
  const selected = displayItems[selectedIndex] ?? null
  const selectedResource =
    selected?.type === 'resource'
      ? knownResource(snapshot.lookup(selected.result.resourceId))
      : null
  const select = async (item: SearchDisplayItem) => {
    if (item.type === 'create') {
      const settlement = await creation.run(item.kind, (signal) =>
        actions.create(item.kind, null, '', signal),
      )
      if (settlement.status === 'completed') onOpenChange(false)
      return
    }
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
      className={`${showPreview ? 'max-w-4xl' : 'max-w-xl'} m-auto h-[min(80vh,600px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/40 open:flex`}
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
        Search
      </h2>
      <p id="resource-search-description" className="sr-only">
        Search your vault
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
          aria-label="Search"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search…"
          role="combobox"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
        />
        <button
          type="button"
          aria-label="Toggle preview"
          aria-pressed={showPreview}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setShowPreview((value) => !value)}
        >
          <PanelRight className="size-3.5" />
        </button>
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              id="resource-search-results"
              role="listbox"
              aria-label="Search results"
              className="p-1"
            >
              {displayItems.map((item, index) => (
                <SearchItem
                  key={item.type === 'create' ? `create-${item.kind}` : item.result.resourceId}
                  id={`resource-search-${index}`}
                  item={item}
                  disabled={item.type === 'create' && creation.blocked}
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
          </div>
        </div>
        {showPreview && <SearchPreview resource={selectedResource} />}
      </div>
      <div className="flex gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span>↑↓ Navigate</span>
        <span>↵ Open / Run</span>
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
  query: string
  resource: AuthorizedResourceSummary | null
  selected: boolean
}) {
  const kind = item.type === 'create' ? item.kind : resource?.kind
  const Icon = kind ? resourceKindIcon(kind) : Search
  const title =
    item.type === 'create' ? `New ${resourceKindLabel(item.kind)}` : (resource?.title ?? 'Loading…')
  const subtitle =
    item.type === 'create'
      ? 'Create at workspace root'
      : item.result.match.type === 'body'
        ? item.result.match.text
        : resource
          ? resourceKindLabel(resource.kind)
          : ''
  return (
    <button
      id={id}
      role="option"
      type="button"
      aria-selected={selected}
      aria-busy={pending}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted aria-selected:bg-muted"
      onClick={onActivate}
      onMouseEnter={onHover}
    >
      {pending ? (
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

function SearchPreview({ resource }: { resource: AuthorizedResourceSummary | null }) {
  if (!resource) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a result to preview
      </div>
    )
  }
  const Icon = resourceKindIcon(resource.kind)
  return (
    <div className="w-1/2 p-5">
      <Icon className="mb-3 size-8 text-muted-foreground" />
      <h3 className="font-medium">{resource.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{resourceKindLabel(resource.kind)}</p>
      <p className="mt-4 text-xs text-muted-foreground">
        Updated {new Date(resource.updatedAt).toLocaleString()}
      </p>
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

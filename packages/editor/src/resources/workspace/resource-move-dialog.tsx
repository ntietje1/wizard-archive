import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, X } from 'lucide-react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { WorkspaceResourceIndexSnapshot } from '../resource-index-contract'
import { RESOURCE_KIND } from '../resource-record'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import { moveWorkspaceResources } from './resource-operations'
import type { WorkspaceReport } from './resource-operations'
import { useEnsureResourceCollection } from './resource-loading'
import { useModalDialog } from './use-modal-dialog'

const FOLDER_KINDS: ReadonlyArray<'folder'> = [RESOURCE_KIND.folder]

export function ResourceMoveDialog({
  onClose,
  onReport,
  resourceIds,
  runtime,
  snapshot,
}: {
  onClose: () => void
  onReport: WorkspaceReport
  resourceIds: ReadonlyArray<ResourceId>
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
}) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<ResourceId>>(new Set())
  const [pending, setPending] = useState(false)
  const dialogRef = useModalDialog()
  const setExpanded = (resourceId: ResourceId, expanded: boolean) =>
    setExpandedIds((current) => {
      const next = new Set(current)
      if (expanded) next.add(resourceId)
      else next.delete(resourceId)
      return next
    })
  const move = async (destinationParentId: ResourceId | null) => {
    setPending(true)
    const completed = await moveWorkspaceResources(
      runtime,
      resourceIds,
      destinationParentId,
      onReport,
    )
    setPending(false)
    if (completed) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Move resources"
      className="m-auto max-h-[min(34rem,90vh)] w-[calc(100%-2rem)] max-w-md flex-col rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/30 open:flex"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
      onKeyDown={(event) => {
        if (!pending && event.key === 'Escape') onClose()
      }}
    >
      <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
        <h2 className="min-w-0 flex-1 text-sm font-semibold">
          Move {resourceIds.length === 1 ? 'resource' : `${resourceIds.length} resources`}
        </h2>
        <button
          autoFocus
          type="button"
          aria-label="Cancel move"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={pending}
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50"
          disabled={pending || !isEligibleMoveDestination(snapshot, resourceIds, null)}
          onClick={() => void move(null)}
        >
          <Folder className="size-4 text-muted-foreground" />
          Workspace root
        </button>
        <MoveFolderCollection
          expandedIds={expandedIds}
          parentId={null}
          pending={pending}
          resourceIds={resourceIds}
          runtime={runtime}
          snapshot={snapshot}
          onMove={move}
          onSetExpanded={setExpanded}
        />
      </div>
    </dialog>
  )
}

function MoveFolderCollection({
  expandedIds,
  onMove,
  onSetExpanded,
  parentId,
  pending,
  resourceIds,
  runtime,
  snapshot,
}: {
  expandedIds: ReadonlySet<ResourceId>
  onMove: (destinationParentId: ResourceId) => Promise<void>
  onSetExpanded: (resourceId: ResourceId, expanded: boolean) => void
  parentId: ResourceId | null
  pending: boolean
  resourceIds: ReadonlyArray<ResourceId>
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
}) {
  const query = {
    parentId,
    lifecycle: 'active' as const,
    kinds: FOLDER_KINDS,
  }
  const load = useEnsureResourceCollection(runtime, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') {
    if (load.result?.status === 'failed' && load.result.retryable) {
      return (
        <button type="button" className="px-8 py-2 text-xs underline" onClick={load.retry}>
          Try loading folders again
        </button>
      )
    }
    return <p className="px-8 py-2 text-xs text-muted-foreground">Loading folders…</p>
  }
  const folders = sortAuthorizedResourceSummaries(collection.items, 'title', 'ascending')
  if (folders.length === 0) return null

  return (
    <ul className={parentId === null ? 'mt-1' : 'ml-4 border-l border-border pl-1'}>
      {folders.map((folder) => {
        const expanded = expandedIds.has(folder.id)
        return (
          <li key={folder.id}>
            <div className="flex min-w-0 items-center">
              <button
                type="button"
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.title}`}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                disabled={pending}
                onClick={() => onSetExpanded(folder.id, !expanded)}
              >
                {expanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
              <button
                type="button"
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                disabled={pending || !isEligibleMoveDestination(snapshot, resourceIds, folder.id)}
                onClick={() => void onMove(folder.id)}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{folder.title}</span>
              </button>
            </div>
            {expanded && (
              <MoveFolderCollection
                expandedIds={expandedIds}
                parentId={folder.id}
                pending={pending}
                resourceIds={resourceIds}
                runtime={runtime}
                snapshot={snapshot}
                onMove={onMove}
                onSetExpanded={onSetExpanded}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function isEligibleMoveDestination(
  snapshot: WorkspaceResourceIndexSnapshot,
  resourceIds: ReadonlyArray<ResourceId>,
  destinationParentId: ResourceId | null,
): boolean {
  const resourceIdSet = new Set(resourceIds)
  if (destinationParentId !== null) {
    if (resourceIdSet.has(destinationParentId)) return false
    const ancestors = snapshot.ancestors(destinationParentId)
    if (
      ancestors.state !== 'known' ||
      ancestors.value.some((ancestor) => resourceIdSet.has(ancestor.id))
    ) {
      return false
    }
  }
  let changesParent = false
  for (const resourceId of resourceIds) {
    const resource = snapshot.lookup(resourceId)
    if (resource.state !== 'known') return false
    if (resource.value.displayParentId !== destinationParentId) changesParent = true
  }
  return changesParent
}

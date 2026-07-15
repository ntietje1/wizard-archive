import { useEffect, useRef, useState } from 'react'
import { RotateCcw, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { WorkspaceResourceIndexSnapshot } from '../resource-index-contract'
import type { WorkspaceSort } from '../workspace-preferences'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import {
  allowWorkspaceResourceDrop,
  finishWorkspaceTrashDrop,
  leaveWorkspaceResourceDrop,
} from '../workspace-resource-drag'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-presentation'
import { useEnsureResourceCollection } from './resource-loading'

type TrashConfirmation =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'empty' }>
  | Readonly<{ type: 'resource'; resourceId: ResourceId }>

export function ResourceTrashControl({
  actions,
  canEdit,
  onViewChange,
  runtime,
  snapshot,
  sort,
  view,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onViewChange: (view: 'resources' | 'trash') => void
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  view: 'bookmarks' | 'resources' | 'trash'
}) {
  const query = { parentId: null, lifecycle: 'trashed' as const }
  useEnsureResourceCollection(runtime, query)
  const collection = snapshot.list(query)
  const resources =
    collection.state === 'known'
      ? sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
      : []
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<TrashConfirmation>({ type: 'none' })
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const mutate = async (
    resourceIds: ReadonlyArray<ResourceId>,
    type: 'permanentlyDelete' | 'restore',
  ) => {
    setConfirmation({ type: 'none' })
    await actions.changeLifecycle(resourceIds, type)
  }
  const empty = async () => {
    setConfirmation({ type: 'none' })
    await actions.emptyTrash(resources.map((resource) => resource.id))
  }
  const canEmpty = canEdit && collection.state === 'known' && collection.complete

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-pressed={view === 'trash'}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-destructive"
        onClick={() => setOpen((value) => !value)}
        onDragOver={canEdit ? allowWorkspaceResourceDrop : undefined}
        onDragLeave={canEdit ? leaveWorkspaceResourceDrop : undefined}
        onDrop={canEdit ? (event) => void finishWorkspaceTrashDrop(event, actions) : undefined}
      >
        <Trash2 className="size-4" />
        <span className="min-w-0 flex-1 text-left">Trash</span>
        {resources.length > 0 && (
          <span aria-hidden="true" className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {resources.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Trash"
          className="absolute bottom-9 left-0 z-50 flex w-72 flex-col rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <div className="mb-1 flex items-center gap-2 px-1">
            <strong className="min-w-0 flex-1 text-sm font-medium">Trash</strong>
            <button
              type="button"
              aria-label={view === 'trash' ? 'Back to resources' : 'Open full trash view'}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                onViewChange(view === 'trash' ? 'resources' : 'trash')
                setOpen(false)
              }}
            >
              {view === 'trash' ? (
                <RotateCcw className="size-3.5" />
              ) : (
                <SquareArrowOutUpRight className="size-3.5" />
              )}
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {collection.state === 'unknown' && (
              <p className="px-2 py-5 text-center text-sm text-muted-foreground">Loading trash…</p>
            )}
            {collection.state === 'known' && resources.length === 0 && (
              <p className="px-2 py-5 text-center text-sm text-muted-foreground">Trash is empty</p>
            )}
            {resources.map((resource) => {
              const Icon = resourceKindIcon(resource.kind)
              const confirming =
                confirmation.type === 'resource' && confirmation.resourceId === resource.id
              return (
                <div
                  key={resource.id}
                  className="group flex min-w-0 items-center rounded-md px-1 py-1 hover:bg-muted"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      actions.open(resource.id)
                      setOpen(false)
                    }}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{resource.title}</span>
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        aria-label={`Restore ${resource.title}`}
                        className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={() => void mutate([resource.id], 'restore')}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={
                          confirming
                            ? `Confirm delete ${resource.title} forever`
                            : `Delete ${resource.title} forever`
                        }
                        className="inline-flex h-7 items-center justify-center rounded px-1.5 text-xs text-destructive hover:bg-background"
                        onClick={() =>
                          confirming
                            ? void mutate([resource.id], 'permanentlyDelete')
                            : setConfirmation({ type: 'resource', resourceId: resource.id })
                        }
                      >
                        {confirming ? 'Confirm' : <Trash2 className="size-3.5" />}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {resources.length > 0 && canEdit && (
            <div className="mt-2 flex justify-end border-t border-border pt-2">
              <button
                type="button"
                disabled={!canEmpty}
                className="h-7 rounded px-2 text-xs text-destructive hover:bg-muted disabled:opacity-50"
                onClick={() =>
                  confirmation.type === 'empty' ? void empty() : setConfirmation({ type: 'empty' })
                }
              >
                {confirmation.type === 'empty' ? 'Confirm empty trash' : 'Empty Trash'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

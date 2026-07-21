import { useState } from 'react'
import { CircleHelp, RotateCcw, Trash2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { WorkspaceResourceIndexSnapshot } from '../resource-index-contract'
import type { WorkspaceSort } from '../workspace-preferences'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import {
  allowWorkspaceInternalResourceDrop,
  finishWorkspaceTrashDrop,
  leaveWorkspaceResourceDrop,
  workspaceResourceDragSourceProps,
} from '../workspace-resource-drag'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindLabel } from './resource-operations'
import { resourceKindIcon } from './resource-icon'
import { useEnsureResourceCollection } from './resource-loading'

type TrashConfirmation =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'resource'; resourceId: ResourceId }>

export function ResourceTrashControl({
  actions,
  canEdit,
  runtime,
  snapshot,
  sort,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
}) {
  const query = { parentId: null, lifecycle: 'trashed' as const }
  useEnsureResourceCollection(runtime.resources.loader, query)
  const collection = snapshot.list(query)
  const resources =
    collection.state === 'known'
      ? sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
      : []
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<TrashConfirmation>({ type: 'none' })

  const mutate = async (
    resourceIds: ReadonlyArray<ResourceId>,
    type: 'permanentlyDelete' | 'restore',
  ) => {
    setConfirmation({ type: 'none' })
    await actions.changeLifecycle(resourceIds, type)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton
        render={
          <button
            type="button"
            data-workspace-drop-target="trash"
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-destructive"
            onDragOver={canEdit ? allowWorkspaceInternalResourceDrop : undefined}
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
        }
      />
      <PopoverContent
        role="region"
        aria-label="Trash"
        align="start"
        side="top"
        sideOffset={4}
        className="w-80 gap-0 rounded-md p-0"
      >
        <ScrollArea
          className="max-h-[300px]"
          contentClassName="p-2"
          viewportClassName="h-auto max-h-[inherit]"
        >
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
                {...(canEdit ? workspaceResourceDragSourceProps([resource.id]) : {})}
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{resource.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {resourceKindLabel(resource.kind)}
                    </span>
                  </span>
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
        </ScrollArea>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <CircleHelp className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Items in Trash are permanently deleted after 30 days.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

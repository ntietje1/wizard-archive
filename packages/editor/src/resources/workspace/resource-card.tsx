import { MoreVertical } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceSelection, WorkspaceSelectionAction } from '../workspace-selection'
import { workspaceSelectionIntent } from '../workspace-selection'
import {
  workspaceResourceDropTargetProps,
  workspaceResourceInteractionProps,
} from '../workspace-resource-drag'
import type { WorkspaceActions } from './resource-operations'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { resourceContextMenuRequest } from './resource-context-menu-request'
import { resourceDisplayIcon } from './resource-icon'
import './resource-card.css'

const FOLDER_LEFT_PATH =
  'M 100,15 L 85,0 L 10,0 C 5,0 0,5 0,15 L 0,185 C 0,195 5,200 10,200 L 120,200 L 120,15 Z'
const FOLDER_RIGHT_PATH =
  'M 0,15 L 50,15 C 55,15 59,17 60,25 L 60,185 C 60,195 57,200 50,200 L 0,200 Z'

export function ResourceCard({
  actions,
  canEdit,
  onSelectionChange,
  onOpenContextMenu,
  resource,
  selected,
  selection,
  visibleIds,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  resource: AuthorizedResourceSummary
  selected: boolean
  selection: WorkspaceSelection
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const folder = resource.kind === 'folder'
  const interaction = workspaceResourceInteractionProps({
    canEdit,
    contextMenuOrigin: 'workspace',
    onOpenContextMenu,
    onSelectionChange,
    resource,
    selection,
  })
  return (
    <article
      data-resource-id={resource.id}
      data-resource-kind={resource.kind}
      data-selected={selected}
      {...workspaceResourceDropTargetProps({ actions, canEdit, resource })}
      {...interaction}
      className={`group/resource-card relative flex h-[140px] w-full flex-col text-left outline-none ${
        folder
          ? 'resource-folder-card overflow-visible rounded-sm'
          : 'overflow-hidden rounded-md border border-border bg-card p-2 shadow-sm hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring data-[drop-target=true]:outline data-[drop-target=true]:outline-2 data-[drop-target=true]:outline-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring'
      }`}
    >
      {folder && <FolderCardShape selected={selected} />}
      <button
        type="button"
        aria-label={resource.title}
        className="absolute inset-0 z-10 rounded-md outline-none"
        onClick={(event) => selectCard({ actions, event, resource, visibleIds, onSelectionChange })}
      />
      <div
        className={`pointer-events-none relative z-[2] flex min-h-0 flex-1 flex-col ${folder ? 'px-2 pt-3 pb-2' : ''}`}
      >
        <span className="flex min-w-0 items-center gap-2 pr-8">
          <span className="min-w-0 flex-1 truncate p-1 text-sm font-medium">{resource.title}</span>
        </span>
        <ResourceCardIcon resource={resource} />
      </div>
      <button
        type="button"
        aria-label={`More options for ${resource.title}`}
        className={`absolute right-2 z-20 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring group-hover/resource-card:opacity-100 ${
          folder ? 'top-[18px]' : 'top-2'
        }`}
        onClick={(event) => openCardMenu(event, resource, onOpenContextMenu)}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
    </article>
  )
}

function FolderCardShape({ selected }: { selected: boolean }) {
  const fill = selected ? 'text-muted' : 'text-card'
  return (
    <div
      aria-hidden="true"
      className={`resource-folder-card-shape pointer-events-none absolute inset-0 flex size-full ${fill}`}
    >
      <svg
        className="-mr-px block h-full w-[120px] shrink-0 overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 120 200"
      >
        <path d={FOLDER_LEFT_PATH} fill="currentColor" />
      </svg>
      <svg
        className="-mr-px block h-full min-w-5 grow overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 20 200"
      >
        <rect x="0" y="15" width="20" height="185" fill="currentColor" />
      </svg>
      <svg
        className="block h-full w-[60px] shrink-0 overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 60 200"
      >
        <path d={FOLDER_RIGHT_PATH} fill="currentColor" />
      </svg>
      <span
        className={`absolute top-[10.75px] right-5 bottom-[1.5px] left-5 z-[1] ${
          selected ? 'bg-muted' : 'bg-card'
        }`}
      />
    </div>
  )
}

function ResourceCardIcon({ resource }: { resource: AuthorizedResourceSummary }) {
  const Icon = resourceDisplayIcon(resource)
  return (
    <div inert aria-hidden="true" className="min-h-0 flex-1 overflow-hidden rounded-sm bg-muted">
      <span className="flex size-full items-center justify-center">
        <Icon
          className="size-12 text-muted-foreground"
          aria-hidden="true"
          style={{ color: resource.color ?? undefined }}
        />
      </span>
    </div>
  )
}

function selectCard({
  actions,
  event,
  onSelectionChange,
  resource,
  visibleIds,
}: {
  actions: WorkspaceActions
  event: MouseEvent<HTMLButtonElement>
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const intent = workspaceSelectionIntent(event)
  onSelectionChange({ type: 'select', resourceId: resource.id, visibleIds, intent })
  if (intent === 'single') actions.open(resource.id)
}

function openCardMenu(
  event: MouseEvent<HTMLButtonElement>,
  resource: AuthorizedResourceSummary,
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void,
) {
  event.stopPropagation()
  onOpenContextMenu(resourceContextMenuRequest(event, resource, 'workspace'))
}

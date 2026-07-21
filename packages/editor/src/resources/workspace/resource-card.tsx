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

const FOLDER_CARD_HEIGHT = 140
const FOLDER_CARD_WIDTH = 400
const FOLDER_CARD_RADIUS = 4
const FOLDER_TAB_WIDTH = 80
const FOLDER_TAB_HEIGHT = 12
const FOLDER_NOTCH_WIDTH = 12

const FOLDER_CARD_PATH = [
  `M 0,${FOLDER_TAB_HEIGHT + FOLDER_CARD_RADIUS}`,
  `L 0,${FOLDER_CARD_RADIUS}`,
  `A ${FOLDER_CARD_RADIUS},${FOLDER_CARD_RADIUS} 0 0,1 ${FOLDER_CARD_RADIUS},0`,
  `L ${FOLDER_TAB_WIDTH},0`,
  `L ${FOLDER_TAB_WIDTH + FOLDER_NOTCH_WIDTH},${FOLDER_TAB_HEIGHT}`,
  `L ${FOLDER_CARD_WIDTH - FOLDER_CARD_RADIUS},${FOLDER_TAB_HEIGHT}`,
  `A ${FOLDER_CARD_RADIUS},${FOLDER_CARD_RADIUS} 0 0,1 ${FOLDER_CARD_WIDTH},${
    FOLDER_TAB_HEIGHT + FOLDER_CARD_RADIUS
  }`,
  `L ${FOLDER_CARD_WIDTH},${FOLDER_CARD_HEIGHT - FOLDER_CARD_RADIUS}`,
  `A ${FOLDER_CARD_RADIUS},${FOLDER_CARD_RADIUS} 0 0,1 ${
    FOLDER_CARD_WIDTH - FOLDER_CARD_RADIUS
  },${FOLDER_CARD_HEIGHT}`,
  `L ${FOLDER_CARD_RADIUS},${FOLDER_CARD_HEIGHT}`,
  `A ${FOLDER_CARD_RADIUS},${FOLDER_CARD_RADIUS} 0 0,1 0,${
    FOLDER_CARD_HEIGHT - FOLDER_CARD_RADIUS
  }`,
  'Z',
].join(' ')

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
      className={`group/resource-card relative flex h-[140px] w-full flex-col overflow-hidden text-left outline-none focus-within:ring-2 focus-within:ring-ring data-[drop-target=true]:outline data-[drop-target=true]:outline-2 data-[drop-target=true]:outline-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring ${
        folder
          ? 'rounded-sm'
          : 'rounded-md border border-border bg-card p-2 shadow-sm hover:bg-muted/60'
      }`}
    >
      {folder && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${FOLDER_CARD_WIDTH} ${FOLDER_CARD_HEIGHT}`}
        >
          <path
            className={`stroke-[1.25px] ${
              selected ? 'fill-muted stroke-ring' : 'fill-card stroke-border'
            }`}
            d={FOLDER_CARD_PATH}
          />
        </svg>
      )}
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

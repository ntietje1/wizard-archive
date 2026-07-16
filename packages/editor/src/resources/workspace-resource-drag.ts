import type { DragEvent, MouseEvent } from 'react'
import { DOMAIN_ID_KIND, parseDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type { AuthorizedResourceSummary } from './resource-index-contract'
import type { WorkspaceSelection, WorkspaceSelectionAction } from './workspace-selection'
import { resourceContextMenuRequest } from './workspace/resource-context-menu-request'
import type { ResourceContextMenuRequest } from './workspace/resource-context-menu-request'
import type { WorkspaceActions } from './workspace/resource-operations'

const WORKSPACE_RESOURCE_DRAG_TYPE = 'application/x-wizard-archive-resource-ids'
const WORKSPACE_RESOURCE_DRAG_SCHEMA = 'resource-drag-v1'

function beginWorkspaceResourceDrag(
  event: DragEvent<HTMLElement>,
  resource: AuthorizedResourceSummary,
  selection: WorkspaceSelection,
  onSelectionChange: (action: WorkspaceSelectionAction) => void,
) {
  const resourceIds = selection.selectedIds.includes(resource.id)
    ? selection.selectedIds
    : [resource.id]
  if (!selection.selectedIds.includes(resource.id)) {
    onSelectionChange({ type: 'normalizeContext', resourceId: resource.id })
  }
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData(
    WORKSPACE_RESOURCE_DRAG_TYPE,
    JSON.stringify({
      schema: WORKSPACE_RESOURCE_DRAG_SCHEMA,
      resourceIds,
      lifecycle: resource.lifecycle,
    }),
  )
}

export function workspaceResourceInteractionProps({
  actions,
  canEdit,
  onOpenContextMenu,
  onSelectionChange,
  resource,
  selection,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  selection: WorkspaceSelection
}) {
  const interaction = {
    onContextMenu: (event: MouseEvent<HTMLElement>) =>
      onOpenContextMenu(resourceContextMenuRequest(event, resource)),
    onFocus: () => onSelectionChange({ type: 'focus' as const, resourceId: resource.id }),
  }
  if (!canEdit) return { ...interaction, draggable: false as const }
  const onDragStart = (event: DragEvent<HTMLElement>) =>
    beginWorkspaceResourceDrag(event, resource, selection, onSelectionChange)
  if (resource.kind !== 'folder' || resource.lifecycle === 'trashed') {
    return { ...interaction, draggable: true as const, onDragStart }
  }
  return {
    ...interaction,
    draggable: true as const,
    onDragStart,
    onDragOver: allowWorkspaceResourceDrop,
    onDragLeave: leaveWorkspaceResourceDrop,
    onDrop: (event: DragEvent<HTMLElement>) =>
      void finishWorkspaceResourceDrop(event, actions, resource.id),
  }
}

export function allowWorkspaceResourceDrop(event: DragEvent<HTMLElement>) {
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = copyDragRequested(event) ? 'copy' : 'move'
  event.currentTarget.dataset.dropTarget = 'true'
}

export function leaveWorkspaceResourceDrop(event: DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
  delete event.currentTarget.dataset.dropTarget
}

export async function finishWorkspaceResourceDrop(
  event: DragEvent<HTMLElement>,
  actions: WorkspaceActions,
  destinationParentId: ResourceId | null,
) {
  delete event.currentTarget.dataset.dropTarget
  const drag = readWorkspaceResourceDrag(event.dataTransfer)
  if (!drag || (destinationParentId && drag.resourceIds.includes(destinationParentId))) return
  event.preventDefault()
  event.stopPropagation()
  if (drag.lifecycle === 'trashed') {
    const restored = await actions.changeLifecycle(drag.resourceIds, 'restore')
    if (restored) {
      await actions.move(drag.resourceIds, destinationParentId)
    }
    return
  }
  if (copyDragRequested(event)) {
    await actions.duplicate(drag.resourceIds, destinationParentId)
    return
  }
  await actions.move(drag.resourceIds, destinationParentId)
}

export async function finishWorkspaceTrashDrop(
  event: DragEvent<HTMLElement>,
  actions: WorkspaceActions,
) {
  delete event.currentTarget.dataset.dropTarget
  const drag = readWorkspaceResourceDrag(event.dataTransfer)
  if (!drag || drag.lifecycle === 'trashed') return
  event.preventDefault()
  event.stopPropagation()
  await actions.changeLifecycle(drag.resourceIds, 'trash')
}

export function hasWorkspaceResourceDrag(dataTransfer: Pick<DataTransfer, 'types'>): boolean {
  return Array.from(dataTransfer.types).includes(WORKSPACE_RESOURCE_DRAG_TYPE)
}

export function readWorkspaceResourceDrag(dataTransfer: Pick<DataTransfer, 'getData'>): Readonly<{
  resourceIds: ReadonlyArray<ResourceId>
  lifecycle: AuthorizedResourceSummary['lifecycle']
}> | null {
  return parseWorkspaceResourceDrag(dataTransfer.getData(WORKSPACE_RESOURCE_DRAG_TYPE))
}

function parseWorkspaceResourceDrag(value: string): Readonly<{
  resourceIds: ReadonlyArray<ResourceId>
  lifecycle: AuthorizedResourceSummary['lifecycle']
}> | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    return null
  }
  if (
    !isRecord(decoded) ||
    decoded.schema !== WORKSPACE_RESOURCE_DRAG_SCHEMA ||
    (decoded.lifecycle !== 'active' && decoded.lifecycle !== 'trashed') ||
    !Array.isArray(decoded.resourceIds) ||
    decoded.resourceIds.length === 0
  ) {
    return null
  }
  const resourceIds: Array<ResourceId> = []
  for (const candidate of decoded.resourceIds) {
    if (typeof candidate !== 'string') return null
    const resourceId = parseDomainId(DOMAIN_ID_KIND.resource, candidate)
    if (!resourceId) return null
    resourceIds.push(resourceId)
  }
  return { resourceIds: Array.from(new Set(resourceIds)), lifecycle: decoded.lifecycle }
}

function copyDragRequested(event: DragEvent<HTMLElement>) {
  return event.altKey || event.ctrlKey || event.metaKey
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

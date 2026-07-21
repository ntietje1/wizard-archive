import type { DragEvent, MouseEvent } from 'react'
import { DOMAIN_ID_KIND, parseDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type { AuthorizedResourceSummary } from './resource-index-contract'
import type { WorkspaceSelection, WorkspaceSelectionAction } from './workspace-selection'
import { resourceContextMenuRequest } from './workspace/resource-context-menu-request'
import type { ResourceContextMenuRequest } from './workspace/resource-context-menu-request'
import type { WorkspaceActions } from './workspace/resource-operations'
import { hasBrowserPlainTransfer } from './workspace/browser-plain-transfer'
import type { BrowserPlainTransferData } from './workspace/browser-plain-transfer'
import type {
  WorkspaceResourceDragPayload,
  WorkspaceResourceDropTarget,
} from './workspace-resource-drop-plan'

const WORKSPACE_RESOURCE_DRAG_TYPE = 'application/x-wizard-archive-resource-ids'
const WORKSPACE_RESOURCE_DRAG_SCHEMA = 'resource-drag-v1'

type WorkspaceDataTransfer = BrowserPlainTransferData &
  Pick<DataTransfer, 'getData' | 'types'> & { dropEffect: DataTransfer['dropEffect'] }

type WorkspaceDropEvent = Pick<
  DragEvent<HTMLElement>,
  | 'altKey'
  | 'ctrlKey'
  | 'currentTarget'
  | 'metaKey'
  | 'preventDefault'
  | 'stopPropagation'
  | 'target'
> &
  Readonly<{ dataTransfer: WorkspaceDataTransfer }>

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
  canEdit,
  onOpenContextMenu,
  onSelectionChange,
  resource,
  selection,
}: {
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
  return { ...interaction, draggable: true as const, onDragStart }
}

export function workspaceResourceDropTargetProps({
  actions,
  canEdit,
  resource,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  resource: AuthorizedResourceSummary
}) {
  if (!canEdit || resource.kind !== 'folder' || resource.lifecycle === 'trashed') return {}
  return {
    'data-workspace-drop-resource-id': resource.id,
    'data-workspace-drop-target': 'collection' as const,
    onDragOver: allowWorkspaceResourceDrop,
    onDragLeave: leaveWorkspaceResourceDrop,
    onDrop: (event: DragEvent<HTMLElement>) =>
      void finishWorkspaceResourceDrop(event, actions, {
        type: 'collection',
        parentId: resource.id,
        title: resource.title,
      }),
  }
}

export function allowWorkspaceResourceDrop(event: WorkspaceDropEvent) {
  const resourceDrag = hasWorkspaceResourceDrag(event.dataTransfer)
  const fileDrop = hasBrowserPlainTransfer(event.dataTransfer)
  if (!resourceDrag && !fileDrop) return
  event.preventDefault()
  event.stopPropagation()
  clearWorkspaceResourceDropTargets(event.currentTarget.ownerDocument)
  if (fileDrop && browserPlainTransferBlocked(event)) {
    event.dataTransfer.dropEffect = 'none'
    return
  }
  const dropEffect = fileDrop || copyDragRequested(event) ? 'copy' : 'move'
  event.dataTransfer.dropEffect = dropEffect
  event.currentTarget.dataset.dropTarget = 'true'
  event.currentTarget.dataset.dropOperation = dropEffect
}

export function allowWorkspaceInternalResourceDrop(event: WorkspaceDropEvent) {
  if (!hasWorkspaceResourceDrag(event.dataTransfer)) return
  allowWorkspaceResourceDrop(event)
}

export function leaveWorkspaceResourceDrop(event: DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
  delete event.currentTarget.dataset.dropTarget
  delete event.currentTarget.dataset.dropOperation
}

export function clearWorkspaceResourceDropTargets(root: ParentNode) {
  for (const target of root.querySelectorAll<HTMLElement>('[data-drop-operation]')) {
    delete target.dataset.dropTarget
    delete target.dataset.dropOperation
  }
}

export async function finishWorkspaceResourceDrop(
  event: WorkspaceDropEvent,
  actions: Pick<WorkspaceActions, 'drop' | 'importExternal' | 'report'>,
  target: Extract<WorkspaceResourceDropTarget, { type: 'collection' }>,
) {
  delete event.currentTarget.dataset.dropTarget
  delete event.currentTarget.dataset.dropOperation
  const drag = readWorkspaceResourceDrag(event.dataTransfer)
  if (!drag) {
    if (!hasBrowserPlainTransfer(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    if (browserPlainTransferBlocked(event)) {
      actions.report('Drop files on a folder or empty resource area')
      return
    }
    await actions.importExternal(target.parentId, event.dataTransfer)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  await actions.drop(drag, target, copyDragRequested(event))
}

export async function finishWorkspaceTrashDrop(
  event: DragEvent<HTMLElement>,
  actions: WorkspaceActions,
) {
  delete event.currentTarget.dataset.dropTarget
  delete event.currentTarget.dataset.dropOperation
  const drag = readWorkspaceResourceDrag(event.dataTransfer)
  if (!drag) return
  event.preventDefault()
  event.stopPropagation()
  await actions.drop(drag, { type: 'trash' }, false)
}

export function hasWorkspaceResourceDrag(dataTransfer: Pick<DataTransfer, 'types'>): boolean {
  return Array.from(dataTransfer.types).includes(WORKSPACE_RESOURCE_DRAG_TYPE)
}

export function readWorkspaceResourceDrag(
  dataTransfer: Pick<DataTransfer, 'getData'>,
): WorkspaceResourceDragPayload | null {
  return parseWorkspaceResourceDrag(dataTransfer.getData(WORKSPACE_RESOURCE_DRAG_TYPE))
}

function parseWorkspaceResourceDrag(value: string): WorkspaceResourceDragPayload | null {
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

function copyDragRequested(event: Pick<WorkspaceDropEvent, 'altKey' | 'ctrlKey' | 'metaKey'>) {
  return event.altKey || event.ctrlKey || event.metaKey
}

function browserPlainTransferBlocked(
  event: Pick<WorkspaceDropEvent, 'currentTarget' | 'target'>,
): boolean {
  if (event.currentTarget.dataset.externalFileDropDisabled === 'true') return true
  if (!(event.target instanceof Element)) return false
  const resource = event.target.closest<HTMLElement>('[data-resource-kind]')
  return resource?.dataset.resourceKind !== undefined && resource.dataset.resourceKind !== 'folder'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

import type { DragEvent } from 'react'
import { DOMAIN_ID_KIND, parseDomainId } from './domain-id'
import type { ResourceId } from './domain-id'
import type { EditorRuntime } from './editor-runtime-contract'
import type { AuthorizedResourceSummary } from './resource-index-contract'
import type { WorkspaceSelection, WorkspaceSelectionAction } from './workspace-selection'
import {
  duplicateWorkspaceResources,
  moveWorkspaceResources,
} from './workspace/resource-operations'
import type { WorkspaceReport } from './workspace/resource-operations'

const WORKSPACE_RESOURCE_DRAG_TYPE = 'application/x-wizard-archive-resource-ids'
const WORKSPACE_RESOURCE_DRAG_SCHEMA = 'resource-drag-v1'

function beginWorkspaceResourceDrag(
  event: DragEvent<HTMLElement>,
  resourceId: ResourceId,
  selection: WorkspaceSelection,
  onSelectionChange: (action: WorkspaceSelectionAction) => void,
) {
  const resourceIds = selection.selectedIds.includes(resourceId)
    ? selection.selectedIds
    : [resourceId]
  if (!selection.selectedIds.includes(resourceId)) {
    onSelectionChange({ type: 'normalizeContext', resourceId })
  }
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData(
    WORKSPACE_RESOURCE_DRAG_TYPE,
    JSON.stringify({ schema: WORKSPACE_RESOURCE_DRAG_SCHEMA, resourceIds }),
  )
}

export function workspaceResourceDragProps({
  canEdit,
  onReport,
  onSelectionChange,
  resource,
  runtime,
  selection,
}: {
  canEdit: boolean
  onReport: WorkspaceReport
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selection: WorkspaceSelection
}) {
  if (!canEdit || resource.lifecycle !== 'active') return { draggable: false as const }
  const onDragStart = (event: DragEvent<HTMLElement>) =>
    beginWorkspaceResourceDrag(event, resource.id, selection, onSelectionChange)
  if (resource.kind !== 'folder') return { draggable: true as const, onDragStart }
  return {
    draggable: true as const,
    onDragStart,
    onDragOver: allowWorkspaceResourceDrop,
    onDragLeave: leaveWorkspaceResourceDrop,
    onDrop: (event: DragEvent<HTMLElement>) =>
      void finishWorkspaceResourceDrop(event, runtime, resource.id, onReport),
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
  runtime: EditorRuntime,
  destinationParentId: ResourceId | null,
  report: WorkspaceReport,
) {
  delete event.currentTarget.dataset.dropTarget
  const resourceIds = parseWorkspaceResourceDrag(
    event.dataTransfer.getData(WORKSPACE_RESOURCE_DRAG_TYPE),
  )
  if (!resourceIds || (destinationParentId && resourceIds.includes(destinationParentId))) return
  event.preventDefault()
  event.stopPropagation()
  if (copyDragRequested(event)) {
    await duplicateWorkspaceResources(runtime, resourceIds, destinationParentId, report)
    return
  }
  await moveWorkspaceResources(runtime, resourceIds, destinationParentId, report)
}

function parseWorkspaceResourceDrag(value: string): ReadonlyArray<ResourceId> | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    return null
  }
  if (
    !isRecord(decoded) ||
    decoded.schema !== WORKSPACE_RESOURCE_DRAG_SCHEMA ||
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
  return Array.from(new Set(resourceIds))
}

function copyDragRequested(event: DragEvent<HTMLElement>) {
  return event.altKey || event.ctrlKey || event.metaKey
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

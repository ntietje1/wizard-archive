import type { ResourceStructureCommand } from './resource-command-contract'
import type {
  AuthorizedResourceSummary,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import type { ResourceId } from './domain-id'

export type WorkspaceResourceDragPayload = Readonly<{
  resourceIds: ReadonlyArray<ResourceId>
  lifecycle: AuthorizedResourceSummary['lifecycle']
}>

export type WorkspaceResourceDropTarget =
  | Readonly<{ type: 'collection'; parentId: ResourceId | null; title: string }>
  | Readonly<{ type: 'trash' }>

type WorkspaceResourceDropCommand = Extract<
  ResourceStructureCommand,
  { type: 'deepCopy' | 'move' | 'restore' | 'trash' }
>

type WorkspaceResourceDropPlan =
  | Readonly<{
      status: 'accepted'
      effect: 'copy' | 'move' | 'restore' | 'trash'
      label: string
      command: WorkspaceResourceDropCommand
    }>
  | Readonly<{ status: 'rejected'; label: string }>

export function planWorkspaceResourceDrop(
  snapshot: WorkspaceResourceIndexSnapshot,
  drag: WorkspaceResourceDragPayload,
  target: WorkspaceResourceDropTarget,
  copy: boolean,
): WorkspaceResourceDropPlan {
  const resources: Array<AuthorizedResourceSummary> = []
  for (const resourceId of drag.resourceIds) {
    const resource = snapshot.lookup(resourceId)
    if (resource.state !== 'known') {
      return { status: 'rejected', label: 'Resource details are still loading' }
    }
    resources.push(resource.value)
  }
  if (resources.some((resource) => resource.permission !== 'edit')) {
    return { status: 'rejected', label: 'You do not have permission to move this item' }
  }
  const lifecycle = resources[0]?.lifecycle
  if (!lifecycle || resources.some((resource) => resource.lifecycle !== lifecycle)) {
    return { status: 'rejected', label: 'Move active and trashed items separately' }
  }

  if (target.type === 'trash') {
    if (lifecycle === 'trashed') return { status: 'rejected', label: 'Already in Trash' }
    return {
      status: 'accepted',
      effect: 'trash',
      label: `Trash ${itemCountLabel(resources.length)}`,
      command: { type: 'trash', resourceIds: drag.resourceIds },
    }
  }

  const destination = validateDestination(snapshot, drag.resourceIds, target.parentId)
  if (destination) return destination
  const destinationLabel = quotedDestination(target.title)
  if (lifecycle === 'trashed') {
    return {
      status: 'accepted',
      effect: 'restore',
      label: `Restore ${itemCountLabel(resources.length)} to ${destinationLabel}`,
      command: {
        type: 'restore',
        resourceIds: drag.resourceIds,
        destination: target.parentId,
      },
    }
  }
  if (copy) {
    return {
      status: 'accepted',
      effect: 'copy',
      label: `Copy ${itemCountLabel(resources.length)} to ${destinationLabel}`,
      command: {
        type: 'deepCopy',
        sourceRootIds: drag.resourceIds,
        destinationParentId: target.parentId,
      },
    }
  }
  if (resources.every((resource) => resource.displayParentId === target.parentId)) {
    return { status: 'rejected', label: `Already in ${destinationLabel}` }
  }
  return {
    status: 'accepted',
    effect: 'move',
    label: `Move ${itemCountLabel(resources.length)} to ${destinationLabel}`,
    command: {
      type: 'move',
      resourceIds: drag.resourceIds,
      destinationParentId: target.parentId,
    },
  }
}

function validateDestination(
  snapshot: WorkspaceResourceIndexSnapshot,
  resourceIds: ReadonlyArray<ResourceId>,
  parentId: ResourceId | null,
): Extract<WorkspaceResourceDropPlan, { status: 'rejected' }> | null {
  if (parentId === null) return null
  const destination = snapshot.lookup(parentId)
  if (destination.state !== 'known') {
    return { status: 'rejected', label: 'Destination details are still loading' }
  }
  if (destination.value.kind !== 'folder' || destination.value.lifecycle !== 'active') {
    return { status: 'rejected', label: 'Cannot drop here' }
  }
  if (destination.value.permission !== 'edit') {
    return { status: 'rejected', label: 'You do not have permission to move items here' }
  }
  if (resourceIds.includes(parentId)) {
    return { status: 'rejected', label: 'Cannot move a folder into itself' }
  }
  const ancestors = snapshot.ancestors(parentId)
  if (ancestors.state !== 'known') {
    return { status: 'rejected', label: 'Destination ancestry is still loading' }
  }
  if (ancestors.value.some((ancestor) => resourceIds.includes(ancestor.id))) {
    return { status: 'rejected', label: 'Cannot move a folder into itself' }
  }
  return null
}

function itemCountLabel(count: number): string {
  return count === 1 ? 'item' : `${count} items`
}

function quotedDestination(title: string): string {
  return `“${title || 'Untitled folder'}”`
}

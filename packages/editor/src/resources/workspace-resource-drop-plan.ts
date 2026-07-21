import type { ResourceStructureCommand } from './resource-command-contract'
import type {
  AuthorizedResourceSummary,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import type { ResourceId } from './domain-id'
import { planProjectedResourceStructureCommand } from './resource-projected-structure-plan'
import type { ProjectedResourceStructurePlan } from './resource-projected-structure-plan'

export type WorkspaceResourceDragPayload = Readonly<{
  resourceIds: ReadonlyArray<ResourceId>
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
    const command = { type: 'trash' as const, resourceIds: drag.resourceIds }
    const rejection = rejectedStructurePlan(
      planProjectedResourceStructureCommand(snapshot, command),
      'Already in Trash',
    )
    if (rejection) return rejection
    return {
      status: 'accepted',
      effect: 'trash',
      label: `Trash ${itemCountLabel(resources.length)}`,
      command,
    }
  }

  const destination = validateDestination(snapshot, target.parentId)
  if (destination) return destination
  const destinationLabel = quotedDestination(target.title)
  if (lifecycle === 'trashed') {
    const command = {
      type: 'restore' as const,
      resourceIds: drag.resourceIds,
      destination: target.parentId,
    }
    const rejection = rejectedStructurePlan(
      planProjectedResourceStructureCommand(snapshot, command),
    )
    if (rejection) return rejection
    return {
      status: 'accepted',
      effect: 'restore',
      label: `Restore ${itemCountLabel(resources.length)} to ${destinationLabel}`,
      command,
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
  const command = {
    type: 'move' as const,
    resourceIds: drag.resourceIds,
    destinationParentId: target.parentId,
  }
  const structurePlan = planProjectedResourceStructureCommand(snapshot, command)
  const rejection = rejectedStructurePlan(structurePlan)
  if (rejection) return rejection
  if (
    structurePlan.status === 'planned' &&
    structurePlan.plan.patches.every(
      ({ before }) => before.parentId === command.destinationParentId,
    )
  ) {
    return { status: 'rejected', label: `Already in ${destinationLabel}` }
  }
  return {
    status: 'accepted',
    effect: 'move',
    label: `Move ${itemCountLabel(resources.length)} to ${destinationLabel}`,
    command,
  }
}

function validateDestination(
  snapshot: WorkspaceResourceIndexSnapshot,
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
  return null
}

function rejectedStructurePlan(
  result: ProjectedResourceStructurePlan,
  invalidLifecycleLabel = 'Cannot move this item here',
): Extract<WorkspaceResourceDropPlan, { status: 'rejected' }> | null {
  if (result.status === 'planned') return null
  if (result.status === 'unavailable') {
    return { status: 'rejected', label: 'Resource details are still loading' }
  }
  switch (result.reason) {
    case 'hierarchy_cycle':
      return { status: 'rejected', label: 'Cannot move a folder into itself' }
    case 'invalid_lifecycle':
      return { status: 'rejected', label: invalidLifecycleLabel }
    case 'invalid_parent':
    case 'invalid_parent_kind':
      return { status: 'rejected', label: 'Cannot drop here' }
    default:
      return { status: 'rejected', label: 'Cannot move this item here' }
  }
}

function itemCountLabel(count: number): string {
  return count === 1 ? 'item' : `${count} items`
}

function quotedDestination(title: string): string {
  return `“${title || 'Untitled folder'}”`
}

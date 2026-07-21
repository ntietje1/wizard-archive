import type {
  ResourceStructureCommand,
  ResourceStructureRejection,
} from './resource-command-contract'
import type { ResourceId } from './domain-id'
import type {
  AuthorizedResourceSummary,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import {
  planResourceGraphTransition,
  resourceGraphDependencies,
  ResourceGraphRejection,
} from './resource-graph-transition'
import type { ResourceGraph, ResourceGraphPlan } from './resource-graph-transition'
import type { ResourceRecord } from './resource-record'

type ProjectableResourceStructureCommand = Exclude<ResourceStructureCommand, { type: 'deepCopy' }>

export type ProjectedResourceStructurePlan =
  | Readonly<{ status: 'planned'; plan: ResourceGraphPlan }>
  | Readonly<{ status: 'rejected'; reason: ResourceStructureRejection }>
  | Readonly<{ status: 'unavailable'; reason: 'dependency_unavailable' }>

export function planProjectedResourceStructureCommand(
  snapshot: WorkspaceResourceIndexSnapshot,
  command: ProjectableResourceStructureCommand,
): ProjectedResourceStructurePlan {
  const resources = new Map<ResourceId, ResourceRecord>()
  const dependencies = resourceGraphDependencies(command)
  for (const resourceId of dependencies.selectedResourceIds) {
    const loaded = loadResource(
      snapshot,
      resourceId,
      resources,
      dependencies.loadSelectedAncestors,
      command.type === 'create',
    )
    if (!loaded) return { status: 'unavailable', reason: 'dependency_unavailable' }
  }
  if (dependencies.destinationParentId !== null) {
    const loaded = loadResource(
      snapshot,
      dependencies.destinationParentId,
      resources,
      dependencies.loadDestinationAncestors,
      false,
    )
    if (!loaded) return { status: 'unavailable', reason: 'dependency_unavailable' }
  }
  if (dependencies.loadDescendants) {
    collectKnownDescendants(snapshot, dependencies.selectedResourceIds, resources)
  }

  const graph: ResourceGraph = { resources, tombstones: new Map() }
  try {
    return {
      status: 'planned',
      plan: planResourceGraphTransition(graph, snapshot.scope.campaignId, command),
    }
  } catch (error) {
    if (error instanceof ResourceGraphRejection) {
      return { status: 'rejected', reason: error.reason }
    }
    throw error
  }
}

function loadResource(
  snapshot: WorkspaceResourceIndexSnapshot,
  resourceId: ResourceId,
  resources: Map<ResourceId, ResourceRecord>,
  loadAncestors: boolean,
  allowUnknown: boolean,
): boolean {
  const resource = snapshot.lookup(resourceId)
  if (resource.state === 'unknown') return allowUnknown
  if (resource.state === 'missing') return true
  resources.set(resourceId, recordFromSummary(snapshot, resource.value))
  if (!loadAncestors) return true
  const ancestors = snapshot.ancestors(resourceId)
  if (ancestors.state !== 'known') return false
  for (const ancestor of ancestors.value) {
    resources.set(ancestor.id, recordFromSummary(snapshot, ancestor))
  }
  return true
}

function collectKnownDescendants(
  snapshot: WorkspaceResourceIndexSnapshot,
  rootIds: ReadonlyArray<ResourceId>,
  resources: Map<ResourceId, ResourceRecord>,
): void {
  const pending = [...rootIds]
  const visited = new Set<ResourceId>()
  while (pending.length > 0) {
    const resourceId = pending.pop()!
    if (visited.has(resourceId)) continue
    visited.add(resourceId)
    const resource = snapshot.lookup(resourceId)
    if (resource.state !== 'known') continue
    resources.set(resourceId, recordFromSummary(snapshot, resource.value))
    if (resource.value.kind !== 'folder') continue
    for (const lifecycle of ['active', 'trashed'] as const) {
      const children = snapshot.list({ parentId: resourceId, lifecycle })
      if (children.state !== 'known') continue
      for (const child of children.items) {
        resources.set(child.id, recordFromSummary(snapshot, child))
        pending.push(child.id)
      }
    }
  }
}

function recordFromSummary(
  snapshot: WorkspaceResourceIndexSnapshot,
  resource: AuthorizedResourceSummary,
): ResourceRecord {
  const audit = { at: resource.updatedAt, by: snapshot.scope.actorId }
  return {
    id: resource.id,
    campaignId: resource.campaignId,
    parentId: resource.displayParentId,
    kind: resource.kind,
    title: resource.title,
    icon: resource.icon,
    color: resource.color,
    lifecycle:
      resource.lifecycle === 'active'
        ? { state: 'active' }
        : { state: 'trashed', at: resource.updatedAt, by: snapshot.scope.actorId },
    metadataVersion: resource.metadataVersion,
    created: { at: resource.createdAt, by: snapshot.scope.actorId },
    updated: audit,
  }
}

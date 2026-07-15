import type { CampaignId, OperationId, ResourceId } from './domain-id'
import type {
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureRejection,
  UpdateResourceMetadataCommand,
} from './resource-command-contract'
import type { AuditStamp, ResourceRecord } from './resource-record'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE, resourceMetadataValue } from './resource-record'
import {
  advanceResourceMetadataVersion,
  createResourceTombstone,
  initialResourceMetadataVersion,
} from './resource-metadata-version'
import type { ResourceTombstone } from './resource-metadata-version'

export type ResourceGraph = Readonly<{
  resources: ReadonlyMap<ResourceId, ResourceRecord>
  tombstones: ReadonlyMap<ResourceId, ResourceTombstone>
}>

export type ResourceGraphTransition = Readonly<{
  upserted: ReadonlyArray<ResourceRecord>
  deletedResourceIds: ReadonlyArray<ResourceId>
  tombstones: ReadonlyArray<ResourceTombstone>
  receipt: ResourceCommandReceipt
}>

export type ResourceCompensationPlan =
  | Readonly<{
      type: 'updateMetadata'
      resourceId: ResourceId
      changes: UpdateResourceMetadataCommand['changes']
      requiredPostconditions: ReadonlyArray<ResourcePostcondition>
    }>
  | Readonly<{
      type: 'move'
      placements: ReadonlyArray<
        Readonly<{ resourceId: ResourceId; destinationParentId: ResourceId | null }>
      >
      requiredPostconditions: ReadonlyArray<ResourcePostcondition>
    }>
  | Readonly<{
      type: 'trash' | 'restore'
      resourceIds: ReadonlyArray<ResourceId>
      requiredPostconditions: ReadonlyArray<ResourcePostcondition>
    }>

export class ResourceGraphRejection extends Error {
  constructor(readonly reason: ResourceStructureRejection) {
    super(reason)
  }
}

function reject(reason: ResourceStructureRejection): never {
  throw new ResourceGraphRejection(reason)
}

function requireOwnedResource(
  graph: ResourceGraph,
  campaignId: CampaignId,
  resourceId: ResourceId,
): ResourceRecord {
  const resource = graph.resources.get(resourceId)
  if (!resource) return reject('resource_missing')
  if (resource.campaignId !== campaignId) return reject('ownership_mismatch')
  return resource
}

export function requireActiveResourceFolder(
  graph: ResourceGraph,
  campaignId: CampaignId,
  parentId: ResourceId | null,
): ResourceRecord | null {
  if (parentId === null) return null
  const parent = graph.resources.get(parentId)
  if (!parent) return reject('invalid_parent')
  if (parent.campaignId !== campaignId) return reject('ownership_mismatch')
  if (parent.kind !== 'folder') return reject('invalid_parent_kind')
  if (parent.lifecycle.state !== 'active') return reject('invalid_parent')
  return parent
}

export function selectResourceRoots(
  graph: ResourceGraph,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): ReadonlyArray<ResourceRecord> {
  if (resourceIds.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) return reject('closure_too_large')
  const selected = new Set(resourceIds)
  const roots: Array<ResourceRecord> = []
  for (const resourceId of resourceIds) {
    const resource = requireOwnedResource(graph, campaignId, resourceId)
    if (!hasSelectedAncestor(graph, campaignId, resource, selected)) roots.push(resource)
  }
  return roots.sort((left, right) => left.id.localeCompare(right.id))
}

function hasSelectedAncestor(
  graph: ResourceGraph,
  campaignId: CampaignId,
  resource: ResourceRecord,
  selected: ReadonlySet<ResourceId>,
) {
  const visited = new Set<ResourceId>([resource.id])
  let parentId = resource.parentId
  while (parentId !== null) {
    if (selected.has(parentId)) return true
    if (visited.has(parentId)) return reject('hierarchy_cycle')
    visited.add(parentId)
    const parent = graph.resources.get(parentId)
    if (!parent) return reject('invalid_parent')
    if (parent.campaignId !== campaignId) return reject('ownership_mismatch')
    parentId = parent.parentId
  }
  return false
}

export function selectResourceClosure(
  graph: ResourceGraph,
  campaignId: CampaignId,
  roots: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourceRecord> {
  const result: Array<ResourceRecord> = []
  const pending = roots.map((resource) => resource.id)
  const visited = new Set<ResourceId>()
  const children = new Map<ResourceId, Array<ResourceId>>()
  for (const resource of graph.resources.values()) {
    if (resource.campaignId !== campaignId || resource.parentId === null) continue
    const childIds = children.get(resource.parentId) ?? []
    childIds.push(resource.id)
    children.set(resource.parentId, childIds)
  }
  while (pending.length > 0) {
    const resourceId = pending.shift()
    if (resourceId === undefined || visited.has(resourceId)) continue
    visited.add(resourceId)
    result.push(requireOwnedResource(graph, campaignId, resourceId))
    if (result.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) return reject('closure_too_large')
    pending.push(...(children.get(resourceId) ?? []))
  }
  return result.sort((left, right) => left.id.localeCompare(right.id))
}

async function replaceMetadata(
  resource: ResourceRecord,
  changes: Partial<Pick<ResourceRecord, 'parentId' | 'title' | 'icon' | 'color' | 'lifecycle'>>,
  audit: AuditStamp,
): Promise<ResourceRecord> {
  const candidate: ResourceRecord = { ...resource, ...changes, updated: audit }
  const metadataVersion = await advanceResourceMetadataVersion(
    resource.metadataVersion,
    resourceMetadataValue(candidate),
  )
  return metadataVersion === resource.metadataVersion ? resource : { ...candidate, metadataVersion }
}

function present(resources: ReadonlyArray<ResourceRecord>): ReadonlyArray<ResourcePostcondition> {
  return resources.map((resource) => ({
    state: 'present',
    resourceId: resource.id,
    metadataVersion: resource.metadataVersion,
  }))
}

function receipt(
  campaignId: CampaignId,
  operationId: OperationId,
  result: ResourceCommandReceipt['result'],
  postconditions: ReadonlyArray<ResourcePostcondition>,
): ResourceCommandReceipt {
  return { campaignId, operationId, result, postconditions }
}

function ensureNoMoveCycle(
  graph: ResourceGraph,
  campaignId: CampaignId,
  roots: ReadonlyArray<ResourceRecord>,
  destination: ResourceRecord | null,
): void {
  if (!destination) return
  const movedIds = new Set(roots.map((resource) => resource.id))
  const visited = new Set<ResourceId>()
  let ancestor: ResourceRecord | undefined = destination
  while (ancestor) {
    if (movedIds.has(ancestor.id) || visited.has(ancestor.id)) return reject('hierarchy_cycle')
    visited.add(ancestor.id)
    if (visited.size > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) return reject('closure_too_large')
    ancestor =
      ancestor.parentId === null
        ? undefined
        : requireOwnedResource(graph, campaignId, ancestor.parentId)
  }
}

function selectActiveRoots(
  graph: ResourceGraph,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): ReadonlyArray<ResourceRecord> {
  const roots = selectResourceRoots(graph, campaignId, resourceIds)
  if (roots.some((resource) => resource.lifecycle.state !== 'active')) {
    return reject('invalid_lifecycle')
  }
  return roots
}

function emptyTransition(receiptValue: ResourceCommandReceipt): ResourceGraphTransition {
  return { upserted: [], deletedResourceIds: [], tombstones: [], receipt: receiptValue }
}

function requiredPostconditions(
  postconditions: ReadonlyArray<ResourcePostcondition>,
  dependencies: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourcePostcondition> {
  const result = new Map<ResourceId, ResourcePostcondition>()
  for (const dependency of dependencies) {
    result.set(dependency.id, {
      state: 'present',
      resourceId: dependency.id,
      metadataVersion: dependency.metadataVersion,
    })
  }
  for (const postcondition of postconditions) result.set(postcondition.resourceId, postcondition)
  return Array.from(result.values()).sort((left, right) =>
    left.resourceId.localeCompare(right.resourceId),
  )
}

function parentDependencies(
  graph: ResourceGraph,
  campaignId: CampaignId,
  resources: ReadonlyArray<ResourceRecord>,
): ReadonlyArray<ResourceRecord> {
  const result = new Map<ResourceId, ResourceRecord>()
  for (const resource of resources) {
    if (resource.parentId === null) continue
    const parent = requireOwnedResource(graph, campaignId, resource.parentId)
    result.set(parent.id, parent)
  }
  return Array.from(result.values())
}

export function planResourceCompensation(
  graph: ResourceGraph,
  campaignId: CampaignId,
  command: ResourceStructureCommand,
  completed: ResourceCommandReceipt,
): ResourceCompensationPlan | null {
  switch (command.type) {
    case 'create':
      return {
        type: 'trash',
        resourceIds: [command.resourceId],
        requiredPostconditions: completed.postconditions,
      }
    case 'updateMetadata': {
      const resource = requireOwnedResource(graph, campaignId, command.resourceId)
      return {
        type: 'updateMetadata',
        resourceId: resource.id,
        changes: {
          ...(command.changes.title === undefined ? {} : { title: resource.title }),
          ...(command.changes.icon === undefined ? {} : { icon: resource.icon }),
          ...(command.changes.color === undefined ? {} : { color: resource.color }),
        },
        requiredPostconditions: completed.postconditions,
      }
    }
    case 'move': {
      const roots = selectResourceRoots(graph, campaignId, command.resourceIds)
      return {
        type: 'move',
        placements: roots.map((resource) => ({
          resourceId: resource.id,
          destinationParentId: resource.parentId,
        })),
        requiredPostconditions: requiredPostconditions(
          completed.postconditions,
          parentDependencies(graph, campaignId, roots),
        ),
      }
    }
    case 'trash': {
      const roots = selectResourceRoots(graph, campaignId, command.resourceIds)
      return {
        type: 'restore',
        resourceIds: roots.map((resource) => resource.id),
        requiredPostconditions: requiredPostconditions(
          completed.postconditions,
          parentDependencies(graph, campaignId, roots),
        ),
      }
    }
    case 'restore':
      return {
        type: 'trash',
        resourceIds: selectResourceRoots(graph, campaignId, command.resourceIds).map(
          (resource) => resource.id,
        ),
        requiredPostconditions: completed.postconditions,
      }
    case 'deepCopy':
      if (completed.result.type !== 'deepCopied') return reject('content_integrity_failure')
      return {
        type: 'trash',
        resourceIds: completed.result.roots.map((root) => root.destinationRootId),
        requiredPostconditions: completed.postconditions,
      }
    case 'permanentlyDelete':
      return null
  }
}

function postconditionsMatch(
  graph: ResourceGraph,
  conditions: ReadonlyArray<ResourcePostcondition>,
): boolean {
  return conditions.every((condition) => {
    const resource = graph.resources.get(condition.resourceId)
    if (condition.state === 'missing') return resource === undefined
    return (
      resource?.metadataVersion.revision === condition.metadataVersion.revision &&
      resource.metadataVersion.digest === condition.metadataVersion.digest
    )
  })
}

function applyTransitionToGraph(
  graph: ResourceGraph,
  transition: ResourceGraphTransition,
): ResourceGraph {
  const resources = new Map(graph.resources)
  const tombstones = new Map(graph.tombstones)
  for (const resource of transition.upserted) resources.set(resource.id, resource)
  for (const resourceId of transition.deletedResourceIds) resources.delete(resourceId)
  for (const tombstone of transition.tombstones) tombstones.set(tombstone.resourceId, tombstone)
  return { resources, tombstones }
}

export type ResourceCompensationTransition = Readonly<{
  transition: ResourceGraphTransition
  compensation: ResourceCompensationPlan
}>

export async function transitionResourceCompensation(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  plan: ResourceCompensationPlan,
  audit: AuditStamp,
): Promise<ResourceCompensationTransition | null> {
  if (!postconditionsMatch(graph, plan.requiredPostconditions)) return null
  if (plan.type !== 'move') {
    const command: Exclude<
      ResourceStructureCommand,
      { type: 'create' | 'deepCopy' | 'move' | 'permanentlyDelete' }
    > =
      plan.type === 'updateMetadata'
        ? { type: plan.type, resourceId: plan.resourceId, changes: plan.changes }
        : { type: plan.type, resourceIds: plan.resourceIds }
    const transition = await transitionResourceGraph(graph, campaignId, operationId, command, audit)
    const compensation = planResourceCompensation(graph, campaignId, command, transition.receipt)
    if (!compensation) return reject('content_integrity_failure')
    return { transition, compensation }
  }

  if (plan.placements.length === 0) return reject('invalid_command')
  const placementIds = new Set(plan.placements.map((placement) => placement.resourceId))
  if (placementIds.size !== plan.placements.length) return reject('invalid_command')
  const originalResources = plan.placements.map((placement) =>
    requireOwnedResource(graph, campaignId, placement.resourceId),
  )
  const groups = new Map<ResourceId | null, Array<ResourceId>>()
  for (const placement of plan.placements) {
    const ids = groups.get(placement.destinationParentId) ?? []
    ids.push(placement.resourceId)
    groups.set(placement.destinationParentId, ids)
  }

  let working = graph
  const upserted = new Map<ResourceId, ResourceRecord>()
  for (const [destinationParentId, resourceIds] of groups) {
    const transition = await transitionResourceGraph(
      working,
      campaignId,
      operationId,
      { type: 'move', resourceIds, destinationParentId },
      audit,
    )
    for (const resource of transition.upserted) upserted.set(resource.id, resource)
    working = applyTransitionToGraph(working, transition)
  }
  const moved = plan.placements.map((placement) =>
    requireOwnedResource(working, campaignId, placement.resourceId),
  )
  const transition: ResourceGraphTransition = {
    upserted: Array.from(upserted.values()),
    deletedResourceIds: [],
    tombstones: [],
    receipt: receipt(
      campaignId,
      operationId,
      { type: 'moved', resourceIds: moved.map((resource) => resource.id) },
      present(moved),
    ),
  }
  return {
    transition,
    compensation: {
      type: 'move',
      placements: originalResources.map((resource) => ({
        resourceId: resource.id,
        destinationParentId: resource.parentId,
      })),
      requiredPostconditions: requiredPostconditions(
        transition.receipt.postconditions,
        parentDependencies(graph, campaignId, originalResources),
      ),
    },
  }
}

async function createResource(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'create' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const existing = graph.resources.get(command.resourceId)
  if (existing) {
    return reject(existing.campaignId === campaignId ? 'invalid_command' : 'ownership_mismatch')
  }
  const tombstone = graph.tombstones.get(command.resourceId)
  if (tombstone) {
    return reject(tombstone.campaignId === campaignId ? 'invalid_command' : 'ownership_mismatch')
  }
  requireActiveResourceFolder(graph, campaignId, command.parentId)
  const metadata = {
    parentId: command.parentId,
    kind: command.kind,
    title: command.title,
    icon: command.icon,
    color: command.color,
    lifecycle: 'active' as const,
  }
  const resource: ResourceRecord = {
    id: command.resourceId,
    campaignId,
    ...metadata,
    lifecycle: { state: 'active' },
    metadataVersion: await initialResourceMetadataVersion(metadata),
    created: audit,
    updated: audit,
  }
  return {
    ...emptyTransition(
      receipt(
        campaignId,
        operationId,
        { type: 'created', resourceId: resource.id },
        present([resource]),
      ),
    ),
    upserted: [resource],
  }
}

async function updateResourceMetadata(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'updateMetadata' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const resource = requireOwnedResource(graph, campaignId, command.resourceId)
  if (resource.lifecycle.state !== 'active') return reject('invalid_lifecycle')
  const updated = await replaceMetadata(resource, command.changes, audit)
  return {
    ...emptyTransition(
      receipt(
        campaignId,
        operationId,
        { type: 'metadataUpdated', resourceId: resource.id },
        present([updated]),
      ),
    ),
    upserted: updated === resource ? [] : [updated],
  }
}

async function moveResources(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'move' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const roots = selectActiveRoots(graph, campaignId, command.resourceIds)
  const destination = requireActiveResourceFolder(graph, campaignId, command.destinationParentId)
  ensureNoMoveCycle(graph, campaignId, roots, destination)
  const updated = await Promise.all(
    roots.map((resource) =>
      replaceMetadata(resource, { parentId: command.destinationParentId }, audit),
    ),
  )
  return {
    ...emptyTransition(
      receipt(
        campaignId,
        operationId,
        { type: 'moved', resourceIds: updated.map((resource) => resource.id) },
        present(updated),
      ),
    ),
    upserted: updated.filter((resource, index) => resource !== roots[index]),
  }
}

async function trashResources(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'trash' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const roots = selectActiveRoots(graph, campaignId, command.resourceIds)
  const closure = selectResourceClosure(graph, campaignId, roots)
  const updated = await Promise.all(
    closure.map(async (resource) =>
      resource.lifecycle.state === 'trashed'
        ? resource
        : await replaceMetadata(resource, { lifecycle: { state: 'trashed', ...audit } }, audit),
    ),
  )
  return {
    ...emptyTransition(
      receipt(
        campaignId,
        operationId,
        { type: 'trashed', resourceIds: updated.map((resource) => resource.id) },
        present(updated),
      ),
    ),
    upserted: updated.filter((resource, index) => resource !== closure[index]),
  }
}

async function restoreResources(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'restore' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const roots = selectResourceRoots(graph, campaignId, command.resourceIds)
  if (roots.some((resource) => resource.lifecycle.state !== 'trashed')) {
    return reject('invalid_lifecycle')
  }
  const rootIds = new Set(roots.map((resource) => resource.id))
  const closure = selectResourceClosure(graph, campaignId, roots)
  const updated = await Promise.all(
    closure.map(async (resource) => {
      if (resource.lifecycle.state === 'active') return resource
      const parent = resource.parentId === null ? null : graph.resources.get(resource.parentId)
      const parentId =
        rootIds.has(resource.id) &&
        (!parent || parent.campaignId !== campaignId || parent.lifecycle.state !== 'active')
          ? null
          : resource.parentId
      return await replaceMetadata(resource, { parentId, lifecycle: { state: 'active' } }, audit)
    }),
  )
  return {
    ...emptyTransition(
      receipt(
        campaignId,
        operationId,
        { type: 'restored', resourceIds: updated.map((resource) => resource.id) },
        present(updated),
      ),
    ),
    upserted: updated.filter((resource, index) => resource !== closure[index]),
  }
}

async function permanentlyDeleteResources(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'permanentlyDelete' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  const roots = selectResourceRoots(graph, campaignId, command.resourceIds)
  for (const root of roots) {
    const parent = root.parentId === null ? null : graph.resources.get(root.parentId)
    if (
      root.lifecycle.state !== 'trashed' ||
      (parent?.campaignId === campaignId && parent.lifecycle.state === 'trashed')
    ) {
      return reject('invalid_root_selection')
    }
  }
  const closure = selectResourceClosure(graph, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle.state !== 'trashed')) {
    return reject('invalid_lifecycle')
  }
  const tombstones = await Promise.all(
    closure.map((resource) =>
      createResourceTombstone(resource.id, campaignId, resource.metadataVersion, audit.at),
    ),
  )
  const deletedResourceIds = closure.map((resource) => resource.id)
  return {
    upserted: [],
    deletedResourceIds,
    tombstones,
    receipt: receipt(
      campaignId,
      operationId,
      { type: 'permanentlyDeleted', resourceIds: deletedResourceIds },
      deletedResourceIds.map((resourceId) => ({ state: 'missing', resourceId })),
    ),
  }
}

export async function transitionResourceGraph(
  graph: ResourceGraph,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Exclude<ResourceStructureCommand, { type: 'deepCopy' }>,
  audit: AuditStamp,
): Promise<ResourceGraphTransition> {
  switch (command.type) {
    case 'create':
      return await createResource(graph, campaignId, operationId, command, audit)
    case 'updateMetadata':
      return await updateResourceMetadata(graph, campaignId, operationId, command, audit)
    case 'move':
      return await moveResources(graph, campaignId, operationId, command, audit)
    case 'trash':
      return await trashResources(graph, campaignId, operationId, command, audit)
    case 'restore':
      return await restoreResources(graph, campaignId, operationId, command, audit)
    case 'permanentlyDelete':
      return await permanentlyDeleteResources(graph, campaignId, operationId, command, audit)
  }
}

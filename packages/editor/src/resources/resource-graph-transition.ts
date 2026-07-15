import type { CampaignId, OperationId, ResourceId } from './domain-id'
import type {
  ResourceCommandReceipt,
  ResourcePostcondition,
  ResourceStructureCommand,
  ResourceStructureRejection,
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
    const visited = new Set<ResourceId>([resource.id])
    let parentId = resource.parentId
    let nested = false
    while (parentId !== null) {
      if (selected.has(parentId)) {
        nested = true
        break
      }
      if (visited.has(parentId)) return reject('hierarchy_cycle')
      visited.add(parentId)
      const parent = graph.resources.get(parentId)
      if (!parent) return reject('invalid_parent')
      if (parent.campaignId !== campaignId) return reject('ownership_mismatch')
      parentId = parent.parentId
    }
    if (!nested) roots.push(resource)
  }
  return roots.sort((left, right) => left.id.localeCompare(right.id))
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

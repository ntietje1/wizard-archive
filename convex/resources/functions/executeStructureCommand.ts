import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceStructureCommand,
  normalizeResourceStructureCommand,
  resourceStructureInputRejection,
} from '@wizard-archive/editor/resources/command-protocol'
import type {
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
  ResourceStructureRejection,
} from '@wizard-archive/editor/resources/command-contract'
import {
  MAX_SYNCHRONOUS_RESOURCE_CLOSURE,
  canonicalizeResourceTitle,
} from '@wizard-archive/editor/resources/resource-record'
import {
  advanceResourceMetadataVersion,
  createResourceTombstone,
  initialResourceMetadataVersion,
} from '@wizard-archive/editor/resources/resource-metadata-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { WithoutSystemFields } from 'convex/server'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { createCanvasContent } from './canvasContent'
import { createFileContent } from './fileContent'
import { createMapContent } from './mapContent'
import { createNoteContent } from './noteContent'
import { applyResourceDeletion, planResourceDeletion } from './resourceDeletion'
import { findCanonicalResource } from './findCanonicalResource'
import { prepareResourceContentCopies } from './resourceContentCopy'

type ExecuteStructureCommandArgs = {
  operationId: string
  command: ResourceStructureCommand
}

type AuditStamp = { at: number; by: CampaignMemberId }
type MetadataChanges = {
  parentId?: ResourceId | null
  title?: string
  icon?: string | null
  color?: string | null
  lifecycle?: 'active' | 'trashed'
}
type PlannedMetadataUpdate = {
  resource: Doc<'resources'>
  replacement: WithoutSystemFields<Doc<'resources'>> | null
  metadataVersion: VersionStamp
}

class CatalogRejection extends Error {
  constructor(readonly reason: ResourceStructureRejection) {
    super(reason)
  }
}

async function requireResource(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<Doc<'resources'>> {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource) throw new CatalogRejection('resource_missing')
  if (resource.campaignUuid !== campaignId) throw new CatalogRejection('ownership_mismatch')
  return resource
}

async function validateParent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  parentId: ResourceId | null,
): Promise<Doc<'resources'> | null> {
  if (parentId === null) return null
  const parent = await findCanonicalResource(ctx.db, parentId)
  if (!parent) throw new CatalogRejection('invalid_parent')
  if (parent.campaignUuid !== campaignId) throw new CatalogRejection('ownership_mismatch')
  if (parent.kind !== 'folder') throw new CatalogRejection('invalid_parent_kind')
  if (parent.lifecycle !== 'active') throw new CatalogRejection('invalid_parent')
  return parent
}

function completed(
  campaignId: CampaignId,
  operationId: OperationId,
  result: ResourceCommandReceipt['result'],
  postconditions: ResourceCommandReceipt['postconditions'],
): ResourceStructureCommandResult {
  return {
    status: 'completed',
    receipt: {
      campaignId,
      operationId,
      result,
      postconditions,
    },
  }
}

function presentPostcondition(resourceId: ResourceId, metadataVersion: VersionStamp) {
  return { state: 'present' as const, resourceId, metadataVersion }
}

async function planMetadataUpdate(
  resource: Doc<'resources'>,
  changes: MetadataChanges,
  audit: AuditStamp,
): Promise<PlannedMetadataUpdate> {
  const parentId = changes.parentId === undefined ? resource.parentResourceUuid : changes.parentId
  const title = canonicalizeResourceTitle(changes.title ?? resource.title)
  const icon = changes.icon === undefined ? resource.icon : changes.icon
  const color = changes.color === undefined ? resource.color : changes.color
  const lifecycle = changes.lifecycle ?? resource.lifecycle
  const currentVersion = assertVersionStamp(resource.metadataVersion)
  const metadataVersion = await advanceResourceMetadataVersion(currentVersion, {
    parentId,
    kind: resource.kind,
    title,
    icon,
    color,
    lifecycle,
  })
  if (metadataVersion === currentVersion) {
    return { resource, replacement: null, metadataVersion }
  }
  const { _id, _creationTime, ...persisted } = resource
  const common = {
    ...persisted,
    parentResourceUuid: parentId,
    title,
    icon,
    color,
    metadataVersion,
    updatedAt: audit.at,
    updatedByMemberUuid: audit.by,
  }
  const replacement: WithoutSystemFields<Doc<'resources'>> =
    lifecycle === 'trashed'
      ? {
          ...common,
          lifecycle,
          trashedAt: audit.at,
          trashedByMemberUuid: audit.by,
        }
      : {
          ...common,
          lifecycle,
          trashedAt: null,
          trashedByMemberUuid: null,
        }
  return {
    resource,
    replacement,
    metadataVersion,
  }
}

async function applyMetadataUpdates(
  ctx: CampaignMutationCtx,
  updates: ReadonlyArray<PlannedMetadataUpdate>,
): Promise<void> {
  await Promise.all(
    updates.flatMap((update) =>
      update.replacement
        ? [ctx.db.replace('resources', update.resource._id, update.replacement)]
        : [],
    ),
  )
}

async function createResource(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'create' }>,
): Promise<ResourceStructureCommandResult> {
  const existing = await findCanonicalResource(ctx.db, command.resourceId)
  if (existing) {
    throw new CatalogRejection(
      existing.campaignUuid === campaignId ? 'invalid_command' : 'ownership_mismatch',
    )
  }
  const tombstone = await ctx.db
    .query('resourceTombstones')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', command.resourceId))
    .unique()
  if (tombstone) {
    throw new CatalogRejection(
      tombstone.campaignUuid === campaignId ? 'invalid_command' : 'ownership_mismatch',
    )
  }
  await validateParent(ctx, campaignId, command.parentId)

  const metadataVersion = await initialResourceMetadataVersion({
    parentId: command.parentId,
    kind: command.kind,
    title: command.title,
    icon: command.icon,
    color: command.color,
    lifecycle: 'active',
  })
  const now = Date.now()
  await ctx.db.insert('resources', {
    resourceUuid: command.resourceId,
    campaignUuid: campaignId,
    parentResourceUuid: command.parentId,
    kind: command.kind,
    title: command.title,
    icon: command.icon,
    color: command.color,
    lifecycle: 'active',
    trashedAt: null,
    trashedByMemberUuid: null,
    metadataVersion,
    createdAt: now,
    createdByMemberUuid: actorId,
    updatedAt: now,
    updatedByMemberUuid: actorId,
  })
  switch (command.kind) {
    case 'folder':
      break
    case 'note':
      await createNoteContent(ctx, campaignId, command.resourceId, operationId, now)
      break
    case 'file':
      await createFileContent(ctx, campaignId, command.resourceId)
      break
    case 'map':
      await createMapContent(ctx, campaignId, command.resourceId)
      break
    case 'canvas':
      await createCanvasContent(ctx, campaignId, command.resourceId)
      break
  }
  return completed(campaignId, operationId, { type: 'created', resourceId: command.resourceId }, [
    presentPostcondition(command.resourceId, metadataVersion),
  ])
}

async function updateResourceMetadata(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'updateMetadata' }>,
): Promise<ResourceStructureCommandResult> {
  const resource = await requireResource(ctx, campaignId, command.resourceId)
  if (resource.lifecycle !== 'active') throw new CatalogRejection('invalid_lifecycle')

  const update = await planMetadataUpdate(resource, command.changes, {
    at: Date.now(),
    by: actorId,
  })
  await applyMetadataUpdates(ctx, [update])
  return completed(
    campaignId,
    operationId,
    { type: 'metadataUpdated', resourceId: command.resourceId },
    [presentPostcondition(command.resourceId, update.metadataVersion)],
  )
}

async function operationRoots(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): Promise<ReadonlyArray<Doc<'resources'>>> {
  if (resourceIds.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
    throw new CatalogRejection('closure_too_large')
  }
  const selected = new Set(resourceIds)
  const selectedResources = await Promise.all(
    resourceIds.map((resourceId) => requireResource(ctx, campaignId, resourceId)),
  )
  const resources = new Map(selectedResources.map((resource) => [resource.resourceUuid, resource]))
  const roots: Array<Doc<'resources'>> = []
  for (const resource of selectedResources) {
    // Ancestor walks share and bound one mutation-local cache, so their order is intentional.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    if (!(await hasSelectedAncestor(ctx, campaignId, resource, selected, resources))) {
      roots.push(resource)
    }
  }
  return roots.sort((left, right) => left.resourceUuid.localeCompare(right.resourceUuid))
}

async function hasSelectedAncestor(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resource: Doc<'resources'>,
  selected: ReadonlySet<ResourceId>,
  resources: Map<ResourceId, Doc<'resources'>>,
): Promise<boolean> {
  let parentId = resource.parentResourceUuid
  const visited = new Set<ResourceId>()
  while (parentId !== null) {
    if (selected.has(parentId)) return true
    if (visited.has(parentId)) throw new CatalogRejection('hierarchy_cycle')
    visited.add(parentId)
    let parent = resources.get(parentId)
    if (!parent) {
      parent = await requireResource(ctx, campaignId, parentId)
      resources.set(parentId, parent)
      if (resources.size > MAX_SYNCHRONOUS_RESOURCE_CLOSURE * 2) {
        throw new CatalogRejection('closure_too_large')
      }
    }
    parentId = parent.parentResourceUuid
  }
  return false
}

async function descendants(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  roots: ReadonlyArray<Doc<'resources'>>,
): Promise<ReadonlyArray<Doc<'resources'>>> {
  const result: Array<Doc<'resources'>> = []
  const pending = [...roots]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const resource = pending.shift()!
    if (visited.has(resource.resourceUuid)) continue
    visited.add(resource.resourceUuid)
    result.push(resource)
    if (result.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new CatalogRejection('closure_too_large')
    }
    const children = await ctx.db
      .query('resources')
      .withIndex('by_campaign_and_parent', (query) =>
        query.eq('campaignUuid', campaignId).eq('parentResourceUuid', resource.resourceUuid),
      )
      .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1 - result.length)
    pending.push(...children)
  }
  return result.sort((left, right) => left.resourceUuid.localeCompare(right.resourceUuid))
}

async function lifecycleClosure(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
  lifecycle: 'active' | 'trashed',
) {
  const roots = await operationRoots(ctx, campaignId, resourceIds)
  const closure = await descendants(ctx, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle !== lifecycle)) {
    throw new CatalogRejection('invalid_lifecycle')
  }
  return { roots, closure }
}

async function moveResources(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'move' }>,
): Promise<ResourceStructureCommandResult> {
  const [roots, destination] = await Promise.all([
    operationRoots(ctx, campaignId, command.resourceIds),
    validateParent(ctx, campaignId, command.destinationParentId),
  ])
  const movedIds = new Set(roots.map((resource) => resource.resourceUuid))
  let ancestor = destination
  const visited = new Set<string>()
  while (ancestor) {
    if (movedIds.has(ancestor.resourceUuid)) throw new CatalogRejection('hierarchy_cycle')
    if (visited.has(ancestor.resourceUuid)) throw new CatalogRejection('hierarchy_cycle')
    visited.add(ancestor.resourceUuid)
    if (visited.size > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new CatalogRejection('closure_too_large')
    }
    ancestor =
      ancestor.parentResourceUuid === null
        ? null
        : await requireResource(ctx, campaignId, ancestor.parentResourceUuid)
  }
  if (roots.some((resource) => resource.lifecycle !== 'active')) {
    throw new CatalogRejection('invalid_lifecycle')
  }
  const audit = { at: Date.now(), by: actorId }
  const updates = await Promise.all(
    roots.map((resource) =>
      planMetadataUpdate(resource, { parentId: command.destinationParentId }, audit),
    ),
  )
  await applyMetadataUpdates(ctx, updates)
  const resourceIds = updates.map((update) => update.resource.resourceUuid)
  return completed(
    campaignId,
    operationId,
    { type: 'moved', resourceIds },
    updates.map((update) =>
      presentPostcondition(update.resource.resourceUuid, update.metadataVersion),
    ),
  )
}

async function changeLifecycle(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'trash' | 'restore' }>,
): Promise<ResourceStructureCommandResult> {
  const restoring = command.type === 'restore'
  const { roots, closure } = await lifecycleClosure(
    ctx,
    campaignId,
    command.resourceIds,
    restoring ? 'trashed' : 'active',
  )
  const rootIds = new Set(roots.map((resource) => resource.resourceUuid))
  const audit = { at: Date.now(), by: actorId }
  const updates: Array<PlannedMetadataUpdate> = []
  for (const resource of closure) {
    let parentId = resource.parentResourceUuid
    if (restoring && rootIds.has(resource.resourceUuid) && parentId !== null) {
      const parent = await findCanonicalResource(ctx.db, parentId)
      if (!parent || parent.campaignUuid !== campaignId || parent.lifecycle !== 'active') {
        parentId = null
      }
    }
    updates.push(
      await planMetadataUpdate(
        resource,
        { parentId, lifecycle: restoring ? 'active' : 'trashed' },
        audit,
      ),
    )
  }
  await applyMetadataUpdates(ctx, updates)
  const resourceIds = updates.map((update) => update.resource.resourceUuid)
  return completed(
    campaignId,
    operationId,
    { type: restoring ? 'restored' : 'trashed', resourceIds },
    updates.map((update) =>
      presentPostcondition(update.resource.resourceUuid, update.metadataVersion),
    ),
  )
}

async function permanentlyDeleteResources(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'permanentlyDelete' }>,
): Promise<ResourceStructureCommandResult> {
  const roots = await operationRoots(ctx, campaignId, command.resourceIds)
  const parents = await Promise.all(
    roots.map(async (root) =>
      root.parentResourceUuid === null
        ? null
        : await findCanonicalResource(ctx.db, root.parentResourceUuid),
    ),
  )
  for (const [index, root] of roots.entries()) {
    const parent = parents[index]
    if (
      root.lifecycle !== 'trashed' ||
      (parent?.campaignUuid === campaignId && parent.lifecycle === 'trashed')
    ) {
      throw new CatalogRejection('invalid_root_selection')
    }
  }
  const closure = await descendants(ctx, campaignId, roots)
  if (closure.some((resource) => resource.lifecycle !== 'trashed')) {
    throw new CatalogRejection('invalid_lifecycle')
  }
  const deletion = await planResourceDeletion(ctx, campaignId, closure)
  if (!deletion) throw new CatalogRejection('closure_too_large')

  const deletedAt = Date.now()
  const tombstones = await Promise.all(
    closure.map(async (resource) => {
      return await createResourceTombstone(
        resource.resourceUuid,
        campaignId,
        assertVersionStamp(resource.metadataVersion),
        deletedAt,
      )
    }),
  )
  await applyResourceDeletion(ctx, deletion)
  await Promise.all([
    ...closure.map((resource) => ctx.db.delete(resource._id)),
    ...tombstones.map((tombstone) =>
      ctx.db.insert('resourceTombstones', {
        resourceUuid: tombstone.resourceId,
        campaignUuid: tombstone.campaignId,
        deletionVersion: tombstone.deletionVersion,
        deletedAt: tombstone.deletedAt,
      }),
    ),
  ])
  const resourceIds = closure.map((resource) => resource.resourceUuid)
  return completed(
    campaignId,
    operationId,
    { type: 'permanentlyDeleted', resourceIds },
    resourceIds.map((resourceId) => ({ state: 'missing', resourceId })),
  )
}

function copiedResourceId(
  resourceMap: ReadonlyMap<ResourceId, ResourceId>,
  sourceId: ResourceId,
): ResourceId {
  const resourceId = resourceMap.get(sourceId)
  if (!resourceId) throw new CatalogRejection('content_integrity_failure')
  return resourceId
}

async function deepCopyResources(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'deepCopy' }>,
): Promise<ResourceStructureCommandResult> {
  await validateParent(ctx, campaignId, command.destinationParentId)
  const { roots, closure } = await lifecycleClosure(
    ctx,
    campaignId,
    command.sourceRootIds,
    'active',
  )
  const rootIds = new Set(roots.map((root) => root.resourceUuid))
  const resourceMap = new Map(
    closure.map((resource) => [resource.resourceUuid, generateDomainId(DOMAIN_ID_KIND.resource)]),
  )
  const now = Date.now()
  const copies = await Promise.all(
    closure.map(async (source) => {
      const sourceId = source.resourceUuid
      const resourceId = copiedResourceId(resourceMap, sourceId)
      let parentId = command.destinationParentId
      if (!rootIds.has(sourceId)) {
        if (source.parentResourceUuid === null) {
          throw new CatalogRejection('content_integrity_failure')
        }
        parentId = copiedResourceId(resourceMap, source.parentResourceUuid)
      }
      const title = canonicalizeResourceTitle(source.title)
      if (title !== source.title) throw new CatalogRejection('content_integrity_failure')
      const metadataVersion = await initialResourceMetadataVersion({
        parentId,
        kind: source.kind,
        title,
        icon: source.icon,
        color: source.color,
        lifecycle: 'active',
      })
      return { resourceId, parentId, source, title, metadataVersion }
    }),
  )

  const content = await prepareResourceContentCopies(
    ctx,
    campaignId,
    operationId,
    copies.map((copy) => ({
      sourceResourceId: copy.source.resourceUuid,
      destinationResourceId: copy.resourceId,
      kind: copy.source.kind,
    })),
  )
  if (content.status === 'unavailable') throw new CatalogRejection('content_unavailable')
  if (content.status === 'integrity_error') {
    throw new CatalogRejection('content_integrity_failure')
  }

  await Promise.all(
    copies.map((copy) =>
      ctx.db.insert('resources', {
        resourceUuid: copy.resourceId,
        campaignUuid: campaignId,
        parentResourceUuid: copy.parentId,
        kind: copy.source.kind,
        title: copy.title,
        icon: copy.source.icon,
        color: copy.source.color,
        lifecycle: 'active',
        trashedAt: null,
        trashedByMemberUuid: null,
        metadataVersion: copy.metadataVersion,
        createdAt: now,
        createdByMemberUuid: actorId,
        updatedAt: now,
        updatedByMemberUuid: actorId,
      }),
    ),
  )
  await Promise.all(content.commits.map((commit) => commit()))

  return completed(
    campaignId,
    operationId,
    {
      type: 'deepCopied',
      roots: roots.map((root) => ({
        sourceRootId: root.resourceUuid,
        destinationRootId: copiedResourceId(resourceMap, root.resourceUuid),
      })),
    },
    copies.map((copy) => presentPostcondition(copy.resourceId, copy.metadataVersion)),
  )
}

async function applyCommand(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: ResourceStructureCommand,
): Promise<ResourceStructureCommandResult> {
  switch (command.type) {
    case 'create':
      return await createResource(ctx, campaignId, actorId, operationId, command)
    case 'updateMetadata':
      return await updateResourceMetadata(ctx, campaignId, actorId, operationId, command)
    case 'move':
      return await moveResources(ctx, campaignId, actorId, operationId, command)
    case 'trash':
    case 'restore':
      return await changeLifecycle(ctx, campaignId, actorId, operationId, command)
    case 'permanentlyDelete':
      return await permanentlyDeleteResources(ctx, campaignId, operationId, command)
    case 'deepCopy':
      return await deepCopyResources(ctx, campaignId, actorId, operationId, command)
  }
}

export async function executeStructureCommand(
  ctx: CampaignMutationCtx,
  args: ExecuteStructureCommandArgs,
): Promise<ResourceStructureCommandResult> {
  let operationId: OperationId
  let command: ResourceStructureCommand
  try {
    operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
    command = normalizeResourceStructureCommand(args.command)
  } catch (error) {
    return { status: 'rejected', reason: resourceStructureInputRejection(error) }
  }

  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'rejected', reason: 'unauthorized' }
  }
  const { campaignId, actorId } = ctx.resourceScope
  const [fingerprint, stored] = await Promise.all([
    fingerprintResourceStructureCommand(command),
    ctx.db
      .query('resourceOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query.eq('campaignUuid', campaignId).eq('operationUuid', operationId),
      )
      .unique(),
  ])
  if (stored) {
    if (stored.actorMemberUuid !== actorId || stored.fingerprint !== fingerprint) {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    return {
      status: 'completed',
      receipt: stored.receipt as unknown as ResourceCommandReceipt,
    }
  }

  try {
    const result = await applyCommand(ctx, campaignId, actorId, operationId, command)
    if (result.status === 'completed') {
      await ctx.db.insert('resourceOperations', {
        campaignUuid: campaignId,
        actorMemberUuid: actorId,
        operationUuid: operationId,
        protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
        fingerprint,
        receipt: result.receipt as unknown as Doc<'resourceOperations'>['receipt'],
      })
    }
    return result
  } catch (error) {
    if (error instanceof CatalogRejection) {
      return { status: 'rejected', reason: error.reason }
    }
    if (error instanceof RangeError && error.message === 'version_exhausted') {
      return { status: 'rejected', reason: 'version_exhausted' }
    }
    throw error
  }
}

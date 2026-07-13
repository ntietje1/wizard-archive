import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
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
import type { ResourceCampaignMutationCtx } from '../../functions'

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

async function getResource(ctx: ResourceCampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resources')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

async function requireResource(
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<Doc<'resources'>> {
  const resource = await getResource(ctx, resourceId)
  if (!resource) throw new CatalogRejection('resource_missing')
  if (resource.campaignUuid !== campaignId) throw new CatalogRejection('ownership_mismatch')
  return resource
}

async function validateParent(
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  parentId: ResourceId | null,
): Promise<Doc<'resources'> | null> {
  if (parentId === null) return null
  const parent = await getResource(ctx, parentId)
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
    parentId: parentId as ResourceId | null,
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
  ctx: ResourceCampaignMutationCtx,
  updates: ReadonlyArray<PlannedMetadataUpdate>,
): Promise<void> {
  for (const update of updates) {
    if (update.replacement) {
      await ctx.db.replace('resources', update.resource._id, update.replacement)
    }
  }
}

async function createResource(
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'create' }>,
): Promise<ResourceStructureCommandResult> {
  const existing = await getResource(ctx, command.resourceId)
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
  return completed(campaignId, operationId, { type: 'created', resourceId: command.resourceId }, [
    presentPostcondition(command.resourceId, metadataVersion),
  ])
}

async function updateResourceMetadata(
  ctx: ResourceCampaignMutationCtx,
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
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  resourceIds: ReadonlyArray<ResourceId>,
): Promise<ReadonlyArray<Doc<'resources'>>> {
  if (resourceIds.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
    throw new CatalogRejection('closure_too_large')
  }
  const selected = new Set(resourceIds)
  const resources = new Map<ResourceId, Doc<'resources'>>()
  for (const resourceId of resourceIds) {
    resources.set(resourceId, await requireResource(ctx, campaignId, resourceId))
  }
  const roots: Array<Doc<'resources'>> = []
  for (const resource of resources.values()) {
    if (!(await hasSelectedAncestor(ctx, campaignId, resource, selected, resources))) {
      roots.push(resource)
    }
  }
  return roots.sort((left, right) => left.resourceUuid.localeCompare(right.resourceUuid))
}

async function hasSelectedAncestor(
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  resource: Doc<'resources'>,
  selected: ReadonlySet<ResourceId>,
  resources: Map<ResourceId, Doc<'resources'>>,
): Promise<boolean> {
  let parentId = resource.parentResourceUuid as ResourceId | null
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
    parentId = parent.parentResourceUuid as ResourceId | null
  }
  return false
}

async function descendants(
  ctx: ResourceCampaignMutationCtx,
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
  ctx: ResourceCampaignMutationCtx,
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
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'move' }>,
): Promise<ResourceStructureCommandResult> {
  const roots = await operationRoots(ctx, campaignId, command.resourceIds)
  const destination = await validateParent(ctx, campaignId, command.destinationParentId)
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
        : await requireResource(ctx, campaignId, ancestor.parentResourceUuid as ResourceId)
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
  const resourceIds = updates.map((update) => update.resource.resourceUuid as ResourceId)
  return completed(
    campaignId,
    operationId,
    { type: 'moved', resourceIds },
    updates.map((update) =>
      presentPostcondition(update.resource.resourceUuid as ResourceId, update.metadataVersion),
    ),
  )
}

async function changeLifecycle(
  ctx: ResourceCampaignMutationCtx,
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
    let parentId = resource.parentResourceUuid as ResourceId | null
    if (restoring && rootIds.has(resource.resourceUuid) && parentId !== null) {
      const parent = await getResource(ctx, parentId)
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
  const resourceIds = updates.map((update) => update.resource.resourceUuid as ResourceId)
  return completed(
    campaignId,
    operationId,
    { type: restoring ? 'restored' : 'trashed', resourceIds },
    updates.map((update) =>
      presentPostcondition(update.resource.resourceUuid as ResourceId, update.metadataVersion),
    ),
  )
}

async function permanentlyDeleteResources(
  ctx: ResourceCampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  command: Extract<ResourceStructureCommand, { type: 'permanentlyDelete' }>,
): Promise<ResourceStructureCommandResult> {
  const roots = await operationRoots(ctx, campaignId, command.resourceIds)
  for (const root of roots) {
    const parent =
      root.parentResourceUuid === null
        ? null
        : await getResource(ctx, root.parentResourceUuid as ResourceId)
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

  const aliases: Array<Doc<'resourceSourcePathAliases'>> = []
  const roles: Array<Doc<'resourceRoles'>> = []
  const contentVersions: Array<Doc<'resourceContentVersions'>> = []
  for (const resource of closure) {
    const remaining =
      MAX_SYNCHRONOUS_RESOURCE_CLOSURE - aliases.length - roles.length - contentVersions.length
    if (remaining < 0) throw new CatalogRejection('closure_too_large')
    aliases.push(
      ...(await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource_and_normalizedPath', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(remaining + 1)),
    )
    roles.push(
      ...(await ctx.db
        .query('resourceRoles')
        .withIndex('by_campaign_and_resource', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(remaining + 1)),
    )
    contentVersions.push(
      ...(await ctx.db
        .query('resourceContentVersions')
        .withIndex('by_resource_and_component', (query) =>
          query.eq('resourceUuid', resource.resourceUuid),
        )
        .take(remaining + 1)),
    )
    if (aliases.length + roles.length + contentVersions.length > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) {
      throw new CatalogRejection('closure_too_large')
    }
  }

  const deletedAt = Date.now()
  const tombstones = await Promise.all(
    closure.map(async (resource) => {
      return await createResourceTombstone(
        resource.resourceUuid as ResourceId,
        campaignId,
        assertVersionStamp(resource.metadataVersion),
        deletedAt,
      )
    }),
  )
  for (const row of [...aliases, ...roles, ...contentVersions]) await ctx.db.delete(row._id)
  for (let index = 0; index < closure.length; index += 1) {
    const resource = closure[index]!
    const tombstone = tombstones[index]!
    await ctx.db.delete(resource._id)
    await ctx.db.insert('resourceTombstones', {
      resourceUuid: tombstone.resourceId,
      campaignUuid: tombstone.campaignId,
      deletionVersion: tombstone.deletionVersion,
      deletedAt: tombstone.deletedAt,
    })
  }
  const resourceIds = closure.map((resource) => resource.resourceUuid as ResourceId)
  return completed(
    campaignId,
    operationId,
    { type: 'permanentlyDeleted', resourceIds },
    resourceIds.map((resourceId) => ({ state: 'missing', resourceId })),
  )
}

async function applyCommand(
  ctx: ResourceCampaignMutationCtx,
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
      return { status: 'unavailable', reason: 'capability_not_supported' }
  }
}

export async function executeStructureCommand(
  ctx: ResourceCampaignMutationCtx,
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
  const fingerprint = await fingerprintResourceStructureCommand(command)
  const stored = await ctx.db
    .query('resourceOperations')
    .withIndex('by_campaign_and_operation', (query) =>
      query.eq('campaignUuid', campaignId).eq('operationUuid', operationId),
    )
    .unique()
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

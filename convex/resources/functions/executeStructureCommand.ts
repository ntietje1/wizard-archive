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
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import {
  advanceResourceMetadataVersion,
  initialResourceMetadataVersion,
} from '@wizard-archive/editor/resources/resource-metadata-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { ResourceCampaignMutationCtx } from '../../functions'

type ExecuteStructureCommandArgs = {
  operationId: string
  command: ResourceStructureCommand
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
): Promise<void> {
  if (parentId === null) return
  const parent = await getResource(ctx, parentId)
  if (!parent) throw new CatalogRejection('invalid_parent')
  if (parent.campaignUuid !== campaignId) throw new CatalogRejection('ownership_mismatch')
  if (parent.kind !== 'folder') throw new CatalogRejection('invalid_parent_kind')
  if (parent.lifecycle !== 'active') throw new CatalogRejection('invalid_parent')
}

function completed(
  campaignId: CampaignId,
  operationId: OperationId,
  result: ResourceCommandReceipt['result'],
  resourceId: ResourceId,
  metadataVersion: VersionStamp,
): ResourceStructureCommandResult {
  return {
    status: 'completed',
    receipt: {
      campaignId,
      operationId,
      result,
      postconditions: [{ state: 'present', resourceId, metadataVersion }],
    },
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
  return completed(
    campaignId,
    operationId,
    { type: 'created', resourceId: command.resourceId },
    command.resourceId,
    metadataVersion,
  )
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

  const metadata = {
    parentId: resource.parentResourceUuid as ResourceId | null,
    kind: resource.kind,
    title: command.changes.title ?? canonicalizeResourceTitle(resource.title),
    icon: command.changes.icon === undefined ? resource.icon : command.changes.icon,
    color: command.changes.color === undefined ? resource.color : command.changes.color,
    lifecycle: resource.lifecycle,
  }
  const currentVersion = assertVersionStamp(resource.metadataVersion)
  const metadataVersion = await advanceResourceMetadataVersion(currentVersion, metadata)
  if (metadataVersion !== currentVersion) {
    await ctx.db.patch('resources', resource._id, {
      title: metadata.title,
      icon: metadata.icon,
      color: metadata.color,
      metadataVersion,
      updatedAt: Date.now(),
      updatedByMemberUuid: actorId,
    })
  }
  return completed(
    campaignId,
    operationId,
    { type: 'metadataUpdated', resourceId: command.resourceId },
    command.resourceId,
    metadataVersion,
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
    case 'trash':
    case 'restore':
    case 'permanentlyDelete':
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

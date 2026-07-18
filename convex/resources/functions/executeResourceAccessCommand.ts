import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceAccessCommand,
  normalizeResourceAccessCommand,
} from '@wizard-archive/editor/resources/command-protocol'
import type {
  ResourceAccessCommand,
  ResourceAccessCommandResult,
  ResourceAccessReceipt,
  ResourceAccessRejection,
} from '@wizard-archive/editor/resources/command-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { loadResourceAccessPolicy } from './resourceAccess'

export async function executeResourceAccessCommand(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  commandInput: ResourceAccessCommand,
): Promise<ResourceAccessCommandResult> {
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'rejected', reason: 'unauthorized' }
  }

  let command: ResourceAccessCommand
  try {
    command = normalizeResourceAccessCommand(commandInput)
  } catch (error) {
    return {
      status: 'rejected',
      reason:
        error instanceof Error && error.message.includes('permission')
          ? 'invalid_permission'
          : 'invalid_command',
    }
  }

  const [fingerprint, stored] = await Promise.all([
    fingerprintResourceAccessCommand(command),
    ctx.db
      .query('resourceAccessOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('operationUuid', operationId),
      )
      .unique(),
  ])
  const replay = replayStoredOperation(ctx, stored, fingerprint)
  if (replay) return replay

  const resourceIds = commandResourceIds(command)
  const resources = await Promise.all(
    resourceIds.map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  const resourceRejection = validateResources(ctx, command, resources)
  if (resourceRejection) return { status: 'rejected', reason: resourceRejection }

  if (
    (command.type === 'setMemberAccess' || command.type === 'clearMemberAccess') &&
    !(await isAcceptedPlayer(ctx, command.memberId))
  ) {
    return { status: 'rejected', reason: 'invalid_command' }
  }

  await applyAccessCommand(ctx, command, resourceIds)
  const receipt: ResourceAccessReceipt = {
    campaignId: ctx.resourceScope.campaignId,
    operationId,
    resourceIds,
  }
  await ctx.db.insert('resourceAccessOperations', {
    campaignUuid: ctx.resourceScope.campaignId,
    actorMemberUuid: ctx.resourceScope.actorId,
    operationUuid: operationId,
    protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
    fingerprint,
    receipt: storedReceipt(receipt),
  })
  return { status: 'completed', receipt }
}

function commandResourceIds(command: ResourceAccessCommand): ReadonlyArray<ResourceId> {
  return command.type === 'setFolderAccessInheritance' ? [command.folderId] : command.resourceIds
}

function validateResources(
  ctx: CampaignMutationCtx,
  command: ResourceAccessCommand,
  resources: ReadonlyArray<Doc<'resources'> | null>,
): ResourceAccessRejection | null {
  if (resources.some((resource) => resource === null)) return 'resource_missing'
  if (
    resources.some(
      (resource) =>
        resource?.campaignUuid !== ctx.resourceScope.campaignId || resource.lifecycle !== 'active',
    )
  ) {
    return 'ownership_mismatch'
  }
  if (command.type === 'setFolderAccessInheritance' && resources[0]?.kind !== 'folder') {
    return 'invalid_resource_kind'
  }
  return null
}

async function isAcceptedPlayer(
  ctx: CampaignMutationCtx,
  memberId: CampaignMemberId,
): Promise<boolean> {
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaignMemberUuid', (query) => query.eq('campaignMemberUuid', memberId))
    .unique()
  return (
    member?.campaignId === ctx.campaign._id &&
    member.role === CAMPAIGN_MEMBER_ROLE.Player &&
    member.status === CAMPAIGN_MEMBER_STATUS.Accepted
  )
}

async function applyAccessCommand(
  ctx: CampaignMutationCtx,
  command: ResourceAccessCommand,
  resourceIds: ReadonlyArray<ResourceId>,
): Promise<void> {
  switch (command.type) {
    case 'setAudienceAccess':
      await Promise.all(
        resourceIds.map(async (resourceId) => {
          const policy = await requirePolicy(ctx, resourceId)
          await ctx.db.patch(policy._id, { audiencePermission: command.permission })
        }),
      )
      return
    case 'setMemberAccess':
      await Promise.all(
        resourceIds.map(async (resourceId) => {
          await requirePolicy(ctx, resourceId)
          const existing = await loadMemberAccess(ctx, resourceId, command.memberId)
          if (existing) {
            await ctx.db.patch(existing._id, { permission: command.permission })
          } else {
            await ctx.db.insert('resourceMemberAccess', {
              campaignUuid: ctx.resourceScope.campaignId,
              resourceUuid: resourceId,
              memberUuid: command.memberId,
              permission: command.permission,
            })
          }
        }),
      )
      return
    case 'clearMemberAccess':
      await Promise.all(
        resourceIds.map(async (resourceId) => {
          await requirePolicy(ctx, resourceId)
          const existing = await loadMemberAccess(ctx, resourceId, command.memberId)
          if (existing) await ctx.db.delete(existing._id)
        }),
      )
      return
    case 'setFolderAccessInheritance': {
      const policy = await requirePolicy(ctx, command.folderId)
      if (policy.subject !== 'folder') throw new TypeError('Folder access policy is corrupt')
      await ctx.db.patch(policy._id, { inheritance: command.inheritance })
    }
  }
}

async function loadMemberAccess(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
) {
  return await ctx.db
    .query('resourceMemberAccess')
    .withIndex('by_resource_and_member', (query) =>
      query
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .eq('resourceUuid', resourceId)
        .eq('memberUuid', memberId),
    )
    .unique()
}

async function requirePolicy(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const policy = await loadResourceAccessPolicy(ctx, ctx.resourceScope.campaignId, resourceId)
  if (!policy) throw new TypeError('Resource access policy is missing')
  return policy
}

function replayStoredOperation(
  ctx: CampaignMutationCtx,
  stored: Doc<'resourceAccessOperations'> | null,
  fingerprint: string,
): ResourceAccessCommandResult | null {
  if (!stored) return null
  if (stored.actorMemberUuid !== ctx.resourceScope.actorId || stored.fingerprint !== fingerprint) {
    return { status: 'rejected', reason: 'operation_id_reused' }
  }
  return { status: 'completed', receipt: receiptFromRow(stored.receipt) }
}

function storedReceipt(receipt: ResourceAccessReceipt) {
  return {
    campaignId: receipt.campaignId,
    operationId: receipt.operationId,
    resourceIds: [...receipt.resourceIds],
  }
}

function receiptFromRow(
  receipt: Doc<'resourceAccessOperations'>['receipt'],
): ResourceAccessReceipt {
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, receipt.campaignId)
  const operationId = assertDomainId(DOMAIN_ID_KIND.operation, receipt.operationId)
  const resourceIds = receipt.resourceIds.map((resourceId) =>
    assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
  )
  return {
    campaignId,
    operationId,
    resourceIds,
  }
}

import { MAX_RESOURCE_BOOKMARKS_PER_ACTOR } from '@wizard-archive/editor/resources/command-contract'
import type {
  ResourceBookmarkCommand,
  ResourceBookmarkCommandResult,
  ResourceBookmarkReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import {
  RESOURCE_COMMAND_PROTOCOL_VERSION,
  fingerprintResourceBookmarkCommand,
  normalizeResourceBookmarkCommand,
} from '@wizard-archive/editor/resources/command-protocol'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { loadActorBookmarks } from './resourceBookmarks'

export async function executeBookmarkCommand(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  commandInput: ResourceBookmarkCommand,
): Promise<ResourceBookmarkCommandResult> {
  let command: ResourceBookmarkCommand
  try {
    command = normalizeResourceBookmarkCommand(commandInput)
  } catch (error) {
    return {
      status: 'rejected',
      reason:
        error instanceof Error && error.message.includes('too large')
          ? 'selection_too_large'
          : 'invalid_command',
    }
  }
  const [fingerprint, existingOperation] = await Promise.all([
    fingerprintResourceBookmarkCommand(command),
    ctx.db
      .query('resourceBookmarkOperations')
      .withIndex('by_campaign_and_operation', (index) =>
        index.eq('campaignUuid', ctx.resourceScope.campaignId).eq('operationUuid', operationId),
      )
      .unique(),
  ])
  if (existingOperation) {
    if (
      existingOperation.actorMemberUuid !== ctx.resourceScope.actorId ||
      existingOperation.fingerprint !== fingerprint
    ) {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    return { status: 'completed', receipt: receiptFromRow(existingOperation.receipt) }
  }

  const resources = await Promise.all(
    command.resourceIds.map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  if (
    resources.some(
      (resource) => !resource || resource.campaignUuid !== ctx.resourceScope.campaignId,
    )
  ) {
    return { status: 'rejected', reason: 'resource_missing' }
  }

  const existingBookmarks = await Promise.all(
    command.resourceIds.map((resourceId) =>
      ctx.db
        .query('resourceBookmarks')
        .withIndex('by_member_and_resource', (index) =>
          index
            .eq('campaignUuid', ctx.resourceScope.campaignId)
            .eq('memberUuid', ctx.resourceScope.actorId)
            .eq('resourceUuid', resourceId),
        )
        .unique(),
    ),
  )
  if (command.bookmarked) {
    const current = await loadActorBookmarks(ctx)
    const additions = existingBookmarks.filter((bookmark) => !bookmark).length
    if (current.length + additions > MAX_RESOURCE_BOOKMARKS_PER_ACTOR) {
      return { status: 'rejected', reason: 'selection_too_large' }
    }
  }

  const now = Date.now()
  await Promise.all(
    command.resourceIds.map(async (resourceId, index) => {
      const existing = existingBookmarks[index]
      if (command.bookmarked && !existing) {
        await ctx.db.insert('resourceBookmarks', {
          campaignUuid: ctx.resourceScope.campaignId,
          memberUuid: ctx.resourceScope.actorId,
          resourceUuid: resourceId,
          bookmarkedAt: now,
        })
      } else if (!command.bookmarked && existing) {
        await ctx.db.delete(existing._id)
      }
    }),
  )
  const receipt = bookmarkReceipt(ctx, operationId, command)
  await ctx.db.insert('resourceBookmarkOperations', {
    campaignUuid: ctx.resourceScope.campaignId,
    actorMemberUuid: ctx.resourceScope.actorId,
    operationUuid: operationId,
    protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION,
    fingerprint,
    receipt: { ...receipt, resourceIds: [...receipt.resourceIds] },
  })
  return { status: 'completed', receipt }
}

function bookmarkReceipt(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  command: ResourceBookmarkCommand,
): ResourceBookmarkReceipt {
  return {
    campaignId: ctx.resourceScope.campaignId,
    operationId,
    resourceIds: command.resourceIds,
    bookmarked: command.bookmarked,
  }
}

function receiptFromRow(receipt: {
  campaignId: string
  operationId: string
  resourceIds: ReadonlyArray<string>
  bookmarked: boolean
}): ResourceBookmarkReceipt {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, receipt.campaignId),
    operationId: assertDomainId(DOMAIN_ID_KIND.operation, receipt.operationId),
    resourceIds: receipt.resourceIds.map((resourceId) =>
      assertDomainId(DOMAIN_ID_KIND.resource, resourceId),
    ),
    bookmarked: receipt.bookmarked,
  }
}

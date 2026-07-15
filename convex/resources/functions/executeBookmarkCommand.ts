import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceBookmarkCommandResult,
  ResourceBookmarkReceipt,
} from '@wizard-archive/editor/resources/command-contract'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

export async function executeBookmarkCommand(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  resourceIdsInput: ReadonlyArray<ResourceId>,
  bookmarked: boolean,
): Promise<ResourceBookmarkCommandResult> {
  const resourceIds = Array.from(new Set(resourceIdsInput)).sort()
  if (resourceIds.length === 0) return { status: 'rejected', reason: 'invalid_command' }
  const existingOperation = await ctx.db
    .query('resourceBookmarkOperations')
    .withIndex('by_campaign_and_operation', (index) =>
      index.eq('campaignUuid', ctx.resourceScope.campaignId).eq('operationUuid', operationId),
    )
    .unique()
  if (existingOperation) {
    if (
      existingOperation.actorMemberUuid !== ctx.resourceScope.actorId ||
      existingOperation.bookmarked !== bookmarked ||
      !sameIds(existingOperation.resourceUuids, resourceIds)
    ) {
      return { status: 'rejected', reason: 'operation_id_reused' }
    }
    return { status: 'completed', receipt: receipt(ctx, operationId, resourceIds, bookmarked) }
  }

  const resources = await Promise.all(
    resourceIds.map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  if (
    resources.some(
      (resource) => !resource || resource.campaignUuid !== ctx.resourceScope.campaignId,
    )
  ) {
    return { status: 'rejected', reason: 'resource_missing' }
  }

  const existingBookmarks = await Promise.all(
    resourceIds.map((resourceId) =>
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
  const now = Date.now()
  await Promise.all(
    resourceIds.map(async (resourceId, index) => {
      const existing = existingBookmarks[index]
      if (bookmarked && !existing) {
        await ctx.db.insert('resourceBookmarks', {
          campaignUuid: ctx.resourceScope.campaignId,
          memberUuid: ctx.resourceScope.actorId,
          resourceUuid: resourceId,
          bookmarkedAt: now,
        })
      } else if (!bookmarked && existing) {
        await ctx.db.delete(existing._id)
      }
    }),
  )
  await ctx.db.insert('resourceBookmarkOperations', {
    campaignUuid: ctx.resourceScope.campaignId,
    actorMemberUuid: ctx.resourceScope.actorId,
    operationUuid: operationId,
    resourceUuids: resourceIds,
    bookmarked,
  })
  return { status: 'completed', receipt: receipt(ctx, operationId, resourceIds, bookmarked) }
}

function receipt(
  ctx: CampaignMutationCtx,
  operationId: OperationId,
  resourceIds: ReadonlyArray<ResourceId>,
  bookmarked: boolean,
): ResourceBookmarkReceipt {
  return {
    campaignId: ctx.resourceScope.campaignId,
    operationId,
    resourceIds,
    bookmarked,
  }
}

function sameIds(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

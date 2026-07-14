import { v } from 'convex/values'
import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import { internalAction } from '../_generated/server'

const RETRY_DELAY_MS = 5_000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_external_effect_failure'
}

export const processAssetCopy = internalAction({
  args: { intentId: v.id('resourceAssetCopyIntents') },
  returns: v.null(),
  handler: async (ctx, { intentId }) => {
    const claim = await ctx.runMutation(internal.resources.internalMutations.claimAssetCopy, {
      intentId,
    })
    if (claim.status !== 'ready') return null

    let destinationStorageId: Id<'_storage'> | null = null
    try {
      const blob = await ctx.storage.get(claim.storageId)
      if (!blob) throw new Error('source_bytes_unavailable')
      destinationStorageId = await ctx.storage.store(blob)
      const result = await ctx.runMutation(internal.resources.internalMutations.completeAssetCopy, {
        intentId,
        storageId: destinationStorageId,
        userId: claim.userId,
        originalFileName: claim.originalFileName,
      })
      if (result.status !== 'completed' || !result.keepStorage) {
        await ctx.storage.delete(destinationStorageId)
      }
      destinationStorageId = null
      if (result.retirementCandidateId) {
        await ctx.scheduler.runAfter(0, internal.resources.internalActions.processAssetRetirement, {
          candidateId: result.retirementCandidateId,
        })
      }
    } catch (error) {
      if (destinationStorageId) await ctx.storage.delete(destinationStorageId)
      const failed = await ctx.runMutation(internal.resources.internalMutations.failAssetCopy, {
        intentId,
        error: errorMessage(error),
      })
      if (failed.status === 'completed') {
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.resources.internalActions.processAssetCopy,
          { intentId },
        )
      }
    }
    return null
  },
})

export const processAssetRetirement = internalAction({
  args: { candidateId: v.id('resourceAssetRetirementCandidates') },
  returns: v.null(),
  handler: async (ctx, { candidateId }) => {
    const claim = await ctx.runMutation(internal.resources.internalMutations.claimAssetRetirement, {
      candidateId,
    })
    if (claim.status !== 'completed') return null

    try {
      const authorization = await ctx.runMutation(
        internal.resources.internalMutations.authorizeAssetRetirement,
        { candidateId },
      )
      if (authorization.status === 'deferred') {
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.resources.internalActions.processAssetRetirement,
          { candidateId },
        )
        return null
      }
      if (authorization.status !== 'ready') return null
      await ctx.storage.delete(authorization.storageId)
      await ctx.runMutation(internal.resources.internalMutations.completeAssetRetirement, {
        candidateId,
      })
    } catch (error) {
      const failed = await ctx.runMutation(
        internal.resources.internalMutations.failAssetRetirement,
        { candidateId, error: errorMessage(error) },
      )
      if (failed.status === 'completed') {
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.resources.internalActions.processAssetRetirement,
          { candidateId },
        )
      }
    }
    return null
  },
})

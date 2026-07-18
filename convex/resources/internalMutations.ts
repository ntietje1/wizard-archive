import { v } from 'convex/values'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { internal } from '../_generated/api'
import { internalMutation } from '../_generated/server'
import type { MutationCtx } from '../_generated/server'
import {
  campaignResourceDeletionStageValidator,
  deleteCampaignResourceBatch as deleteCampaignResourceBatchFn,
} from './functions/resourceDeletion'
import { campaignIdValidator } from '../campaigns/schema'
import { versionStampValidator } from './schema'
import { resourceIdValidator } from './validators'
import { cleanupNoteBlockAccess as cleanupNoteBlockAccessFn } from './functions/noteBlockAccessCleanup'

const workResult = v.union(
  v.object({ status: v.literal('unavailable') }),
  v.object({ status: v.literal('completed') }),
)

export const deleteCampaignResourceBatch = internalMutation({
  args: {
    campaignId: campaignIdValidator,
    stage: campaignResourceDeletionStageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, args.campaignId)
    const nextStage = await deleteCampaignResourceBatchFn(ctx, campaignId, args.stage)
    if (nextStage) {
      await ctx.scheduler.runAfter(
        0,
        internal.resources.internalMutations.deleteCampaignResourceBatch,
        { campaignId, stage: nextStage },
      )
    } else {
      await ctx.scheduler.runAfter(0, internal.campaigns.internalMutations.deleteCampaignRows, {
        campaignId,
        stage: 'sessions',
      })
    }
    return null
  },
})

export const cleanupNoteBlockAccess = internalMutation({
  args: {
    campaignId: campaignIdValidator,
    noteId: resourceIdValidator,
    contentVersion: versionStampValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await cleanupNoteBlockAccessFn(ctx, args.campaignId, args.noteId, args.contentVersion)
    return null
  },
})

async function setContentAssetState(
  ctx: MutationCtx,
  resourceUuid: string,
  state: 'initializing' | 'ready' | 'failed',
) {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, resourceUuid)
  const [file, map] = await Promise.all([
    ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique(),
    ctx.db
      .query('resourceMapContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique(),
  ])
  if (file) await ctx.db.patch(file._id, { state })
  if (map) await ctx.db.patch(map._id, { state })
}

async function ensureRetirementCandidate(ctx: MutationCtx, assetUuid: string) {
  const assetId = assertDomainId(DOMAIN_ID_KIND.asset, assetUuid)
  const existing = await ctx.db
    .query('resourceAssetRetirementCandidates')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
    .unique()
  if (existing) return existing._id
  return await ctx.db.insert('resourceAssetRetirementCandidates', {
    assetUuid: assetId,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: Date.now(),
  })
}

export const claimAssetCopy = internalMutation({
  args: { intentId: v.id('resourceAssetCopyIntents') },
  returns: v.union(
    v.object({ status: v.literal('unavailable') }),
    v.object({
      status: v.literal('ready'),
      storageId: v.id('_storage'),
      originalFileName: v.nullable(v.string()),
    }),
  ),
  handler: async (ctx, { intentId }) => {
    const intent = await ctx.db.get('resourceAssetCopyIntents', intentId)
    if (!intent || intent.status === 'processing') return { status: 'unavailable' as const }
    const source = await ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', intent.sourceAssetUuid))
      .unique()
    if (!source || source.status !== 'committed' || source.storageId === null) {
      await ctx.db.patch(intentId, {
        status: 'failed',
        attempts: intent.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: 'source_asset_unavailable',
      })
      await setContentAssetState(ctx, intent.resourceUuid, 'failed')
      return { status: 'unavailable' as const }
    }
    await ctx.db.patch(intentId, {
      status: 'processing',
      attempts: intent.attempts + 1,
      lastAttemptAt: Date.now(),
      lastError: null,
    })
    return {
      status: 'ready' as const,
      storageId: source.storageId,
      originalFileName: source.originalFileName,
    }
  },
})

export const completeAssetCopy = internalMutation({
  args: {
    intentId: v.id('resourceAssetCopyIntents'),
    storageId: v.id('_storage'),
    originalFileName: v.nullable(v.string()),
  },
  returns: v.union(
    v.object({
      status: v.literal('abandoned'),
      retirementCandidateId: v.nullable(v.id('resourceAssetRetirementCandidates')),
    }),
    v.object({
      status: v.literal('completed'),
      keepStorage: v.boolean(),
      retirementCandidateId: v.nullable(v.id('resourceAssetRetirementCandidates')),
    }),
  ),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get('resourceAssetCopyIntents', args.intentId)
    if (!intent || intent.status !== 'processing') {
      return { status: 'abandoned' as const, retirementCandidateId: null }
    }
    const owner = await ctx.db
      .query('resourceAssetOwners')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', intent.destinationAssetUuid))
      .first()
    if (!owner || owner.resourceUuid !== intent.resourceUuid) {
      await ctx.db.delete(args.intentId)
      return {
        status: 'abandoned' as const,
        retirementCandidateId: await ensureRetirementCandidate(ctx, intent.destinationAssetUuid),
      }
    }

    const existing = await ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', intent.destinationAssetUuid))
      .unique()
    if (!existing) {
      await ctx.db.insert('fileStorage', {
        assetUuid: intent.destinationAssetUuid,
        storageId: args.storageId,
        userId: null,
        status: 'committed',
        originalFileName: args.originalFileName,
      })
    }
    await ctx.db.delete(args.intentId)
    const [sourceRetirementCandidate, remaining] = await Promise.all([
      ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', intent.sourceAssetUuid))
        .unique(),
      ctx.db
        .query('resourceAssetCopyIntents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', intent.resourceUuid))
        .first(),
    ])
    if (!remaining) await setContentAssetState(ctx, intent.resourceUuid, 'ready')
    return {
      status: 'completed' as const,
      keepStorage: !existing,
      retirementCandidateId: sourceRetirementCandidate?._id ?? null,
    }
  },
})

export const failAssetCopy = internalMutation({
  args: { intentId: v.id('resourceAssetCopyIntents'), error: v.string() },
  returns: workResult,
  handler: async (ctx, { intentId, error }) => {
    const intent = await ctx.db.get('resourceAssetCopyIntents', intentId)
    if (!intent) return { status: 'unavailable' as const }
    await ctx.db.patch(intentId, { status: 'failed', lastError: error.slice(0, 200) })
    await setContentAssetState(ctx, intent.resourceUuid, 'failed')
    return { status: 'completed' as const }
  },
})

export const claimAssetRetirement = internalMutation({
  args: { candidateId: v.id('resourceAssetRetirementCandidates') },
  returns: workResult,
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get('resourceAssetRetirementCandidates', candidateId)
    if (!candidate || candidate.status === 'processing') return { status: 'unavailable' as const }
    await ctx.db.patch(candidateId, {
      status: 'processing',
      attempts: candidate.attempts + 1,
      lastAttemptAt: Date.now(),
      lastError: null,
    })
    return { status: 'completed' as const }
  },
})

export const authorizeAssetRetirement = internalMutation({
  args: { candidateId: v.id('resourceAssetRetirementCandidates') },
  returns: v.union(
    v.object({ status: v.literal('unavailable') }),
    v.object({ status: v.literal('completed') }),
    v.object({ status: v.literal('deferred') }),
    v.object({ status: v.literal('ready'), storageId: v.id('_storage') }),
  ),
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get('resourceAssetRetirementCandidates', candidateId)
    if (!candidate || candidate.status !== 'processing') return { status: 'unavailable' as const }
    const owner = await ctx.db
      .query('resourceAssetOwners')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', candidate.assetUuid))
      .first()
    if (owner) {
      await ctx.db.delete(candidateId)
      return { status: 'completed' as const }
    }
    const copyDependency = await ctx.db
      .query('resourceAssetCopyIntents')
      .withIndex('by_sourceAssetUuid', (query) => query.eq('sourceAssetUuid', candidate.assetUuid))
      .first()
    if (copyDependency) {
      await ctx.db.patch(candidateId, { status: 'pending' })
      return { status: 'deferred' as const }
    }
    const storage = await ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', candidate.assetUuid))
      .unique()
    if (!storage?.storageId) {
      if (storage) await ctx.db.delete(storage._id)
      await ctx.db.delete(candidateId)
      return { status: 'completed' as const }
    }
    return { status: 'ready' as const, storageId: storage.storageId }
  },
})

export const completeAssetRetirement = internalMutation({
  args: { candidateId: v.id('resourceAssetRetirementCandidates') },
  returns: v.null(),
  handler: async (ctx, { candidateId }) => {
    const candidate = await ctx.db.get('resourceAssetRetirementCandidates', candidateId)
    if (!candidate) return null
    const storage = await ctx.db
      .query('fileStorage')
      .withIndex('by_assetUuid', (query) => query.eq('assetUuid', candidate.assetUuid))
      .unique()
    if (storage) await ctx.db.delete(storage._id)
    await ctx.db.delete(candidateId)
    return null
  },
})

export const failAssetRetirement = internalMutation({
  args: { candidateId: v.id('resourceAssetRetirementCandidates'), error: v.string() },
  returns: workResult,
  handler: async (ctx, { candidateId, error }) => {
    const candidate = await ctx.db.get('resourceAssetRetirementCandidates', candidateId)
    if (!candidate) return { status: 'unavailable' as const }
    await ctx.db.patch(candidateId, { status: 'failed', lastError: error.slice(0, 200) })
    return { status: 'completed' as const }
  },
})

export const retryAssetCopy = internalMutation({
  args: { intentId: v.id('resourceAssetCopyIntents'), staleBefore: v.number() },
  returns: workResult,
  handler: async (ctx, { intentId, staleBefore }) => {
    const intent = await ctx.db.get('resourceAssetCopyIntents', intentId)
    if (
      !intent ||
      intent.status === 'pending' ||
      (intent.status === 'processing' &&
        (intent.lastAttemptAt === null || intent.lastAttemptAt > staleBefore))
    ) {
      return { status: 'unavailable' as const }
    }
    await ctx.db.patch(intentId, { status: 'pending', lastError: null })
    await setContentAssetState(ctx, intent.resourceUuid, 'initializing')
    await ctx.scheduler.runAfter(0, internal.resources.internalActions.processAssetCopy, {
      intentId,
    })
    return { status: 'completed' as const }
  },
})

export const retryAssetRetirement = internalMutation({
  args: { candidateId: v.id('resourceAssetRetirementCandidates'), staleBefore: v.number() },
  returns: workResult,
  handler: async (ctx, { candidateId, staleBefore }) => {
    const candidate = await ctx.db.get('resourceAssetRetirementCandidates', candidateId)
    if (
      !candidate ||
      candidate.status === 'pending' ||
      (candidate.status === 'processing' &&
        (candidate.lastAttemptAt === null || candidate.lastAttemptAt > staleBefore))
    ) {
      return { status: 'unavailable' as const }
    }
    await ctx.db.patch(candidateId, { status: 'pending', lastError: null })
    await ctx.scheduler.runAfter(0, internal.resources.internalActions.processAssetRetirement, {
      candidateId,
    })
    return { status: 'completed' as const }
  },
})

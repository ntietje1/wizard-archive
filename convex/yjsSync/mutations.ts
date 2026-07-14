import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { internal } from '../_generated/api'
import { checkYjsReadAccess, checkYjsWriteAccess } from './functions/checkYjsAccess'
import { shouldCompact, SNAPSHOT_IDLE_MS } from './constants'
import { editorBlockInputValidator } from '../blocks/schema'
import { parseBlockNoteBlocks } from '../blocks/parseBlockNoteBlocks'
import { syncNoteIndexesFromBlocks } from '../notes/functions/syncNoteDerivedData'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import type { CampaignMutationCtx } from '../functions'
import type { Doc, Id } from '../_generated/dataModel'
import { getYjsDocumentRevision } from './functions/documentRevision'
import { awarenessLeaseResultValidator, awarenessReleaseResultValidator } from './awareness'
import { AWARENESS_REJECTION_REASON, AWARENESS_TTL_MS } from '../../shared/yjs-sync/awareness'
import type { AwarenessLeaseResult, AwarenessReleaseResult } from '../../shared/yjs-sync/awareness'
import { resourceIdValidator } from '../resources/validators'

const pushUpdateResultValidator = v.union(
  v.object({ status: v.literal('accepted'), seq: v.number() }),
  v.object({ status: v.literal('rejected'), reason: v.literal('revision_mismatch') }),
)

async function insertYjsUpdate(
  ctx: CampaignMutationCtx,
  {
    documentId,
    revision,
    update,
  }: {
    documentId: Id<'sidebarItems'>
    revision: number | undefined
    update: ArrayBuffer
  },
) {
  const currentRevision = await getYjsDocumentRevision(ctx, documentId)
  if ((revision ?? 0) !== currentRevision) {
    return { status: 'rejected' as const, reason: 'revision_mismatch' as const }
  }

  const latest = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .order('desc')
    .first()

  const seq = (latest?.seq ?? -1) + 1

  await ctx.db.insert('yjsUpdates', {
    documentId: documentId,
    update,
    seq,
    isSnapshot: false,
  })

  if (shouldCompact(seq)) {
    await ctx.scheduler.runAfter(0, internal.yjsSync.internalActions.compact, { documentId })
  }

  await ctx.scheduler.runAfter(
    SNAPSHOT_IDLE_MS,
    internal.yjsSync.internalMutations.maybeCreateSnapshot,
    {
      documentId,
      triggerSeq: seq,
      campaignId: ctx.campaign._id,
      campaignMemberId: ctx.membership._id,
      actorId: ctx.membership.campaignMemberUuid,
    },
  )

  return { status: 'accepted' as const, seq }
}

async function checkImportedTextNoteTarget(
  ctx: CampaignMutationCtx,
  documentId: Id<'sidebarItems'>,
) {
  const item = await ctx.db.get('sidebarItems', documentId)
  if (!item || item.campaignId !== ctx.campaign._id || item.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Imported text target must be a note')
  }
}

async function getYjsAwarenessForClient(
  ctx: CampaignMutationCtx,
  documentId: Id<'sidebarItems'>,
  clientId: number,
): Promise<Doc<'yjsAwareness'> | null> {
  return await ctx.db
    .query('yjsAwareness')
    .withIndex('by_document_client', (q) => q.eq('documentId', documentId).eq('clientId', clientId))
    .first()
}

export const pushUpdate = campaignMutation({
  args: {
    documentId: resourceIdValidator,
    revision: v.optional(v.number()),
    update: v.bytes(),
  },
  returns: pushUpdateResultValidator,
  handler: async (ctx, { documentId, revision, update }) => {
    const providerDocumentId = await checkYjsWriteAccess(ctx, documentId)
    return await insertYjsUpdate(ctx, { documentId: providerDocumentId, revision, update })
  },
})

export const pushImportedTextNoteUpdate = campaignMutation({
  args: {
    documentId: resourceIdValidator,
    revision: v.optional(v.number()),
    update: v.bytes(),
    content: v.array(editorBlockInputValidator),
  },
  returns: pushUpdateResultValidator,
  handler: async (ctx, { content, documentId, revision, update }) => {
    const providerDocumentId = await checkYjsWriteAccess(ctx, documentId)
    await checkImportedTextNoteTarget(ctx, providerDocumentId)
    const parsedContent = parseBlockNoteBlocks(content)
    const result = await insertYjsUpdate(ctx, {
      documentId: providerDocumentId,
      revision,
      update,
    })
    if (result.status === 'rejected') return result
    await syncNoteIndexesFromBlocks(ctx, {
      noteId: providerDocumentId,
      content: parsedContent,
    })
    return result
  },
})

export const pushAwareness = campaignMutation({
  args: {
    documentId: resourceIdValidator,
    clientId: v.number(),
    leaseId: v.optional(v.string()),
    state: v.bytes(),
  },
  returns: awarenessLeaseResultValidator,
  handler: async (ctx, { documentId, clientId, leaseId, state }) => {
    const providerDocumentId = await checkYjsReadAccess(ctx, documentId)
    if (!leaseId) return rejectedAwarenessLease(AWARENESS_REJECTION_REASON.leaseRequired)

    const existing = await getYjsAwarenessForClient(ctx, providerDocumentId, clientId)
    if (existing && (existing.userId !== ctx.membership.userId || existing.leaseId !== leaseId)) {
      return rejectedAwarenessLease(AWARENESS_REJECTION_REASON.leaseConflict)
    }

    const updatedAt = Date.now()

    if (existing) {
      await ctx.db.patch('yjsAwareness', existing._id, {
        state,
        updatedAt,
      })
    } else {
      await ctx.db.insert('yjsAwareness', {
        documentId: providerDocumentId,
        clientId,
        userId: ctx.membership.userId,
        leaseId,
        state,
        updatedAt,
      })
    }

    return { status: 'active' as const, expiresAt: updatedAt + AWARENESS_TTL_MS }
  },
})

export const removeAwareness = campaignMutation({
  args: {
    documentId: resourceIdValidator,
    clientId: v.number(),
    leaseId: v.optional(v.string()),
  },
  returns: awarenessReleaseResultValidator,
  handler: async (ctx, { documentId, clientId, leaseId }) => {
    const providerDocumentId = await checkYjsReadAccess(ctx, documentId)
    if (!leaseId) return rejectedAwarenessRelease(AWARENESS_REJECTION_REASON.leaseRequired)

    const existing = await getYjsAwarenessForClient(ctx, providerDocumentId, clientId)
    if (!existing) return { status: 'unavailable' as const }
    if (existing.userId !== ctx.membership.userId || existing.leaseId !== leaseId) {
      return rejectedAwarenessRelease(AWARENESS_REJECTION_REASON.leaseConflict)
    }

    await ctx.db.delete('yjsAwareness', existing._id)

    return { status: 'released' as const }
  },
})

function rejectedAwarenessLease(
  reason: (typeof AWARENESS_REJECTION_REASON)[keyof typeof AWARENESS_REJECTION_REASON],
): AwarenessLeaseResult {
  return { status: 'rejected', reason }
}

function rejectedAwarenessRelease(
  reason: (typeof AWARENESS_REJECTION_REASON)[keyof typeof AWARENESS_REJECTION_REASON],
): AwarenessReleaseResult {
  return { status: 'rejected', reason }
}

import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import { campaignInternalQuery } from '../functions'
import { resolveHistorySnapshot } from './functions/getSnapshot'
import { getYjsDocumentRevision } from '../yjsSync/functions/documentRevision'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { rollbackRejectionReasonValidator } from './rollback'

const rollbackPlanValidator = v.union(
  v.object({
    status: v.literal('rejected'),
    reason: rollbackRejectionReasonValidator,
  }),
  v.object({
    status: v.literal('ready'),
    kind: v.literal('yjs'),
    currentUpdates: v.array(v.bytes()),
    expectedRevision: v.number(),
    expectedSeq: v.number(),
  }),
  v.object({
    status: v.literal('ready'),
    kind: v.literal('game-map'),
  }),
)

export type RollbackPlan = Infer<typeof rollbackPlanValidator>

export const prepareRollback = campaignInternalQuery({
  args: { editHistoryId: v.id('editHistory') },
  returns: rollbackPlanValidator,
  handler: async (ctx, { editHistoryId }) => {
    const resolution = await resolveHistorySnapshot(ctx, { editHistoryId })
    if (resolution.status === 'rejected') return resolution
    if (resolution.historyEntry.itemType === RESOURCE_TYPES.gameMaps) {
      return { status: 'ready' as const, kind: 'game-map' as const }
    }

    const [updates, revision] = await Promise.all([
      ctx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', resolution.historyEntry.itemId))
        .order('asc')
        .collect(),
      getYjsDocumentRevision(ctx, resolution.historyEntry.itemId),
    ])

    return {
      status: 'ready' as const,
      kind: 'yjs' as const,
      currentUpdates: updates.map((update) => update.update),
      expectedRevision: revision,
      expectedSeq: updates[updates.length - 1]?.seq ?? -1,
    }
  },
})

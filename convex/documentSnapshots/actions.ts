'use node'

import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { encodeYjsSnapshot } from '../yjsSync/_yjsNode'
import { rollbackResultValidator } from './rollback'
import type { RollbackServerResult } from './rollback'
import type { RollbackPlan } from './internalQueries'

export const rollbackToSnapshot = action({
  args: {
    campaignId: v.id('campaigns'),
    editHistoryId: v.id('editHistory'),
  },
  returns: rollbackResultValidator,
  handler: async (ctx, { campaignId, editHistoryId }): Promise<RollbackServerResult> => {
    const plan: RollbackPlan = await ctx.runQuery(
      internal.documentSnapshots.internalQueries.prepareRollback,
      {
        campaignId,
        editHistoryId,
      },
    )
    if (plan.status === 'rejected') return plan

    const currentState =
      plan.kind === 'yjs'
        ? {
            kind: 'yjs' as const,
            data: encodeYjsSnapshot(plan.currentUpdates.map((update) => ({ update }))),
            expectedRevision: plan.expectedRevision,
            expectedSeq: plan.expectedSeq,
          }
        : { kind: 'game-map' as const }

    return await ctx.runMutation(internal.documentSnapshots.internalMutations.applyRollback, {
      campaignId,
      currentState,
      editHistoryId,
    })
  },
})

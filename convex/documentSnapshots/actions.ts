'use node'

import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { encodeYjsSnapshot } from '../yjsSync/_yjsNode'
import { rollbackResultValidator } from './rollback'
import type { RollbackServerResult } from './rollback'
import type { RollbackPlan } from './internalQueries'
import { historyEntryIdValidator } from '../editHistory/schema'
import { requireHistoryEntryId } from '../editHistory/functions/getHistoryEntry'
import { campaignIdValidator } from '../campaigns/schema'

export const rollbackToSnapshot = action({
  args: {
    campaignId: campaignIdValidator,
    editHistoryId: historyEntryIdValidator,
  },
  returns: rollbackResultValidator,
  handler: async (ctx, { campaignId, editHistoryId }): Promise<RollbackServerResult> => {
    const campaignRowId = await ctx.runQuery(
      internal.campaigns.internalQueries.resolveCampaignRowId,
      { campaignId },
    )
    const plan: RollbackPlan = await ctx.runQuery(
      internal.documentSnapshots.internalQueries.prepareRollback,
      {
        campaignId: campaignRowId,
        editHistoryId: requireHistoryEntryId(editHistoryId),
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
      campaignId: campaignRowId,
      currentState,
      editHistoryId: plan.editHistoryRowId,
    })
  },
})

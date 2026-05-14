import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function copyYjsUpdates(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const latestTargetUpdate = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', targetItemId))
    .order('desc')
    .first()
  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', sourceItemId))
    .order('asc')
    .collect()
  const firstSeq = (latestTargetUpdate?.seq ?? -1) + 1

  await Promise.all(
    updates.map((update, index) =>
      ctx.db.insert('yjsUpdates', {
        documentId: targetItemId,
        update: update.update,
        seq: firstSeq + index,
        isSnapshot: update.isSnapshot,
      }),
    ),
  )
}

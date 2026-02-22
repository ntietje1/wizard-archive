import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

type SidebarItemId = Id<'notes'> | Id<'folders'> | Id<'gameMaps'> | Id<'files'>

export async function deleteItemSharesAndBookmarks(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
): Promise<void> {
  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  for (const share of shares) {
    await ctx.db.delete(share._id)
  }

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_item', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  for (const bookmark of bookmarks) {
    await ctx.db.delete(bookmark._id)
  }
}

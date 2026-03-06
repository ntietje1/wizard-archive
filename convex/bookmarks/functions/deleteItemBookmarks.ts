import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function deleteItemBookmarks(
  ctx: AuthMutationCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<void> {
  const item = await ctx.db.get(sidebarItemId)
  if (!item) return
  const campaignId = item.campaignId

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_item', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  await Promise.all(bookmarks.map((bookmark) => ctx.db.delete(bookmark._id)))
}

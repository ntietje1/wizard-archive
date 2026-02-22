import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import type { AnySidebarItemFromDb } from './types'
import type { CampaignQueryCtx } from '../functions'

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  item: T,
) {
  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getBookmark(ctx, item.campaignId, ctx.membership._id, item._id),
    getSidebarItemSharesForItem(ctx, item.campaignId, item._id),
    getSidebarItemPermissionLevel(ctx, item),
  ])
  return { ...item, isBookmarked: !!bookmark, shares, myPermissionLevel }
}

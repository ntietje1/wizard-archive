import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getItemBookmark } from '../bookmarks/functions/getItemBookmark'
import type { AnySidebarItemFromDb } from './types'
import type { CampaignQueryCtx } from '../functions'

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  item: T,
) {
  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getItemBookmark(ctx, item._id),
    getSidebarItemSharesForItem(ctx, item._id),
    getSidebarItemPermissionLevel(ctx, item),
  ])
  return { ...item, isBookmarked: !!bookmark, shares, myPermissionLevel }
}

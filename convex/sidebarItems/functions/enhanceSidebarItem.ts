import { enhanceFile } from '../../files/functions/enhanceFile'
import { enhanceFolder } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote } from '../../notes/functions/enhanceNote'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getItemBookmark } from '../../bookmarks/functions/getItemBookmark'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../../shares/itemShares'
import type { AnySidebarItemFromDb, EnhancedSidebarItem } from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

export async function enhanceSidebarItem<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<EnhancedSidebarItem<T>> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, { file: item }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, { gameMap: item }) as Promise<
        EnhancedSidebarItem<T>
      >
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, { folder: item }) as Promise<
        EnhancedSidebarItem<T>
      >
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, { note: item }) as Promise<EnhancedSidebarItem<T>>
    default:
      throw new Error('Unknown item type')
  }
}

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
) {
  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getItemBookmark(ctx, { sidebarItemId: item._id }),
    getSidebarItemSharesForItem(ctx, { sidebarItemId: item._id }),
    getSidebarItemPermissionLevel(ctx, { item }),
  ])
  return { ...item, isBookmarked: !!bookmark, shares, myPermissionLevel }
}

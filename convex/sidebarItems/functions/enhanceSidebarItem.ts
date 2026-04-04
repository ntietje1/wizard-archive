import { enhanceFile } from '../../files/functions/enhanceFile'
import { enhanceFolder } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote } from '../../notes/functions/enhanceNote'
import { enhanceCanvas } from '../../canvases/functions/enhanceCanvas'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { requireCampaignMembership } from '../../functions'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { SidebarItemId } from '../types/baseTypes'
import type { AnySidebarItemFromDb, EnhancedSidebarItem } from '../types/types'
import type { AuthQueryCtx } from '../../functions'

export async function enhanceSidebarItem<T extends AnySidebarItemFromDb>(
  ctx: AuthQueryCtx,
  {
    item,
    sharesMap,
    bookmarkIds,
  }: {
    item: T
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<EnhancedSidebarItem<T>> {
  await requireCampaignMembership(ctx, item.campaignId)
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, {
        file: item,
        sharesMap,
        bookmarkIds,
      }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, {
        gameMap: item,
        sharesMap,
        bookmarkIds,
      }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, {
        folder: item,
        sharesMap,
        bookmarkIds,
      }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, {
        note: item,
        sharesMap,
        bookmarkIds,
      }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvas(ctx, {
        canvas: item,
        sharesMap,
        bookmarkIds,
      }) as Promise<EnhancedSidebarItem<T>>
    default:
      throw new Error('Unknown item type')
  }
}

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: AuthQueryCtx,
  {
    item,
    sharesMap,
    bookmarkIds,
  }: {
    item: T
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
) {
  const { membership } = await requireCampaignMembership(ctx, item.campaignId)

  const thumbnailUrl = item.thumbnailStorageId
    ? await ctx.storage.getUrl(item.thumbnailStorageId)
    : null

  // Batch path: all data is pre-loaded
  if (sharesMap && bookmarkIds) {
    const itemShares = sharesMap.get(item._id)
    return {
      ...item,
      shares: itemShares ? [...itemShares.values()] : [],
      isBookmarked: bookmarkIds.has(item._id),
      myPermissionLevel: await getSidebarItemPermissionLevel(ctx, {
        item,
        sharesMap,
      }),
      thumbnailUrl,
    }
  }

  // Single-item path: direct queries in parallel
  const [shares, bookmark, myPermissionLevel] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', item.campaignId).eq('sidebarItemId', item._id),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect(),
    ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', item.campaignId)
          .eq('campaignMemberId', membership._id)
          .eq('sidebarItemId', item._id),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .unique(),
    getSidebarItemPermissionLevel(ctx, { item }),
  ])

  return {
    ...item,
    shares,
    isBookmarked: bookmark !== null,
    myPermissionLevel,
    thumbnailUrl,
  }
}

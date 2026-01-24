import { getSidebarItemAncestors } from '../folders/folders'
import { getSidebarItemSharesForItem } from '../shares/shares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import type { QueryCtx } from '../_generated/server'
import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
  MapPinWithItem,
} from './types'
import type { AnySidebarItemFromDb } from '../sidebarItems/types'

export const enhanceGameMap = async (
  ctx: QueryCtx,
  gameMap: GameMapFromDb,
): Promise<GameMap> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: gameMap.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const [imageUrl, bookmark, shares] = await Promise.all([
    gameMap.imageStorageId ? ctx.storage.getUrl(gameMap.imageStorageId) : null,
    getBookmark(
      ctx,
      gameMap.campaignId,
      campaignWithMembership.member._id,
      gameMap._id,
    ),
    getSidebarItemSharesForItem(ctx, gameMap.campaignId, gameMap._id),
  ])

  return {
    ...gameMap,
    imageUrl,
    isBookmarked: !!bookmark,
    shares,
  }
}

export const enhanceGameMapWithContent = async (
  ctx: QueryCtx,
  gameMap: GameMap,
): Promise<GameMapWithContent> => {
  const ancestors = await getSidebarItemAncestors(
    ctx,
    gameMap.campaignId,
    gameMap.parentId,
  )

  // Fetch pins with their items directly to avoid circular dependency
  const rawPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', gameMap._id))
    .collect()

  const pins: Array<MapPinWithItem> = []
  for (const pin of rawPins) {
    const item = await ctx.db.get(pin.itemId)
    if (item && item.campaignId === gameMap.campaignId) {
      const enhancedItem = await enhanceSidebarItem(
        ctx,
        item as AnySidebarItemFromDb,
      )
      pins.push({
        ...pin,
        item: enhancedItem,
      })
    }
  }

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

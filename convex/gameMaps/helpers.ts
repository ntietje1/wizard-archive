import { getSidebarItemAncestors } from '../folders/folders'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import type { QueryCtx } from '../_generated/server'
import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
  MapPin,
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

  const [imageUrl, bookmark, shares, myPermissionLevel] = await Promise.all([
    gameMap.imageStorageId ? ctx.storage.getUrl(gameMap.imageStorageId) : null,
    getBookmark(
      ctx,
      gameMap.campaignId,
      campaignWithMembership.member._id,
      gameMap._id,
    ),
    getSidebarItemSharesForItem(ctx, gameMap.campaignId, gameMap._id),
    getSidebarItemPermissionLevel(ctx, gameMap),
  ])

  return {
    ...gameMap,
    imageUrl,
    isBookmarked: !!bookmark,
    shares,
    myPermissionLevel,
  }
}

const enhanceMapPin = async (
  ctx: QueryCtx,
  pin: MapPin,
): Promise<MapPinWithItem | null> => {
  const item = await ctx.db.get(pin.itemId)
  if (item) {
    const enhancedItem = await enhanceSidebarItem(
      ctx,
      item as AnySidebarItemFromDb,
    )
    return {
      ...pin,
      item: enhancedItem,
    }
  }
  return null
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

  const rawPins: Array<MapPin> = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', gameMap._id))
    .collect()

  const pins = (
    await Promise.all(rawPins.map((pin) => enhanceMapPin(ctx, pin)))
  ).filter((pin): pin is MapPinWithItem => pin !== null)

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

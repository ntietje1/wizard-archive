import { getSidebarItemAncestors } from '../folders/folders'
import {
  getSidebarItemPermissionStatus,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { pipeList } from '../common/pipeline'
import type { Id } from '../_generated/dataModel'
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

const enforceMapPinPermissions = async (
  ctx: QueryCtx,
  pin: MapPinWithItem | null,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<MapPinWithItem | null> => {
  if (!pin) return null
  const isPermitted = await getSidebarItemPermissionStatus(
    ctx,
    pin.item,
    viewAsPlayerId,
  )
  return isPermitted ? pin : null
}

export const enhanceGameMapWithContent = async (
  ctx: QueryCtx,
  gameMap: GameMap,
  viewAsPlayerId?: Id<'campaignMembers'>,
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

  const pins = await pipeList(ctx, rawPins)
    .map((ctx, pin) => enhanceMapPin(ctx, pin))
    .enforce((ctx, pin) => enforceMapPinPermissions(ctx, pin, viewAsPlayerId))
    .run()

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

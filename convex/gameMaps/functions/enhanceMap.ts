import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase, enhanceSidebarItem } from '../../sidebarItems/functions/enhanceSidebarItem'
import { requireCampaignMembership } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignBookmarks } from '../../bookmarks/functions/getCampaignBookmarks'
import {
  getAllCampaignShares,
  getMemberShares,
} from '../../sidebarShares/functions/getCampaignShares'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { GameMap, GameMapFromDb, GameMapWithContent, MapPin, MapPinWithItem } from '../types'

export const enhanceGameMap = async (
  ctx: AuthQueryCtx,
  {
    gameMap,
    sharesMap,
    bookmarkIds,
  }: {
    gameMap: GameMapFromDb
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<GameMap> => {
  const [base, imageUrl] = await Promise.all([
    enhanceBase(ctx, { item: gameMap, sharesMap, bookmarkIds }),
    gameMap.imageStorageId ? ctx.storage.getUrl(gameMap.imageStorageId) : null,
  ])

  return {
    ...base,
    imageUrl,
  }
}

const enhanceMapPin = async (
  ctx: AuthQueryCtx,
  {
    pin,
    sharesMap,
    bookmarkIds,
  }: {
    pin: MapPin
    sharesMap: SharesMap
    bookmarkIds: Set<SidebarItemId>
  },
): Promise<MapPinWithItem | null> => {
  const item = await ctx.db.get(pin.itemId)
  if (item) {
    const enhancedItem = await enhanceSidebarItem(ctx, {
      item,
      sharesMap,
      bookmarkIds,
    })
    return {
      ...pin,
      item: enhancedItem,
    }
  }
  return null
}

export const enhanceGameMapWithContent = async (
  ctx: AuthQueryCtx,
  { gameMap }: { gameMap: GameMap },
): Promise<GameMapWithContent> => {
  const { membership } = await requireCampaignMembership(ctx, gameMap.campaignId)
  const hasFullAccess = membership.role === CAMPAIGN_MEMBER_ROLE.DM

  const [ancestors, rawPins, bookmarkIds, sharesMap] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: gameMap.parentId,
      isTrashed: gameMap.location === SIDEBAR_ITEM_LOCATION.trash,
    }),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', gameMap._id))
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect(),
    getCampaignBookmarks(ctx, gameMap.campaignId, membership._id),
    hasFullAccess
      ? getAllCampaignShares(ctx, gameMap.campaignId)
      : getMemberShares(ctx, gameMap.campaignId, membership._id),
  ])

  const pins = (
    await Promise.all(rawPins.map((pin) => enhanceMapPin(ctx, { pin, sharesMap, bookmarkIds })))
  ).filter((pin) => pin !== null)

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

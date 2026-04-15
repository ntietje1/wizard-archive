import { asyncMap } from 'convex-helpers'
import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase, enhanceSidebarItem } from '../../sidebarItems/functions/enhanceSidebarItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { GameMap, GameMapFromDb, GameMapWithContent, MapPin, MapPinWithItem } from '../types'

export const enhanceGameMap = async (
  ctx: CampaignQueryCtx,
  { gameMap }: { gameMap: GameMapFromDb },
): Promise<GameMap> => {
  const [base, imageUrl] = await Promise.all([
    enhanceBase(ctx, { item: gameMap }),
    gameMap.imageStorageId ? ctx.storage.getUrl(gameMap.imageStorageId) : null,
  ])

  return {
    ...base,
    imageUrl,
  }
}

const enhanceMapPin = async (
  ctx: CampaignQueryCtx,
  { pin }: { pin: MapPin },
): Promise<MapPinWithItem | null> => {
  const item = await getSidebarItem(ctx, pin.itemId)
  if (item) {
    const enhancedItem = await enhanceSidebarItem(ctx, { item })
    return {
      ...pin,
      item: enhancedItem,
    }
  }
  return null
}

export const enhanceGameMapWithContent = async (
  ctx: CampaignQueryCtx,
  { gameMap }: { gameMap: GameMap },
): Promise<GameMapWithContent> => {
  const [ancestors, rawPins] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: gameMap.parentId,
      isTrashed: gameMap.location === SIDEBAR_ITEM_LOCATION.trash,
    }),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', gameMap._id))
      .collect(),
  ])

  const pins = (await asyncMap(rawPins, (pin) => enhanceMapPin(ctx, { pin }))).filter(
    (pin) => pin !== null,
  )

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

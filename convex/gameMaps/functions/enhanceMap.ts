import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import {
  enhanceBase,
  enhanceSidebarItem,
} from '../../sidebarItems/functions/enhanceSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
  MapPin,
  MapPinWithItem,
} from '../types'

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
  const item = await ctx.db.get(pin.itemId)
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
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: gameMap.parentId,
    isTrashed: !!gameMap.deletionTime,
  })

  const rawPins: Array<MapPin> = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', gameMap._id))
    .collect()

  const pins = (
    await Promise.all(rawPins.map((pin) => enhanceMapPin(ctx, { pin })))
  ).filter((pin) => pin !== null)

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

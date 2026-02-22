import { getSidebarItemAncestors } from '../folders/folders'
import { enhanceBase } from '../sidebarItems/enhanceBase'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import type { CampaignQueryCtx } from '../functions'
import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
  MapPin,
  MapPinWithItem,
} from './types'
import type { AnySidebarItemFromDb } from '../sidebarItems/types'

export const enhanceGameMap = async (
  ctx: CampaignQueryCtx,
  gameMap: GameMapFromDb,
): Promise<GameMap> => {
  const [base, imageUrl] = await Promise.all([
    enhanceBase(ctx, gameMap),
    gameMap.imageStorageId ? ctx.storage.getUrl(gameMap.imageStorageId) : null,
  ])

  return {
    ...base,
    imageUrl,
  }
}

const enhanceMapPin = async (
  ctx: CampaignQueryCtx,
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
  ctx: CampaignQueryCtx,
  gameMap: GameMap,
): Promise<GameMapWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, gameMap.parentId)

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

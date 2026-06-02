import { asyncMap } from 'convex-helpers'
import { enhanceCanvas } from '../../canvases/functions/enhanceCanvas'
import { enhanceFile } from '../../files/functions/enhanceFile'
import { enhanceFolder } from '../../folders/functions/enhanceFolder'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { enhanceNote } from '../../notes/functions/enhanceNote'
import { assertNever } from '../../common/types'
import type { CampaignQueryCtx } from '../../functions'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
} from '../../../shared/sidebar-items/model-types'
import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
  MapPin,
  MapPinWithItem,
} from '../../../shared/game-maps/types'

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
    const enhancedItem = await enhancePinnedItem(ctx, { item })
    return {
      ...pin,
      item: enhancedItem,
    }
  }
  return null
}

const enhancePinnedItem = async (
  ctx: CampaignQueryCtx,
  { item }: { item: AnySidebarItemFromDb },
): Promise<AnySidebarItem> => {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, { file: item })
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, { gameMap: item })
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, { folder: item })
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, { note: item })
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvas(ctx, { canvas: item })
    default:
      return assertNever(item)
  }
}

export const enhanceGameMapWithContent = async (
  ctx: CampaignQueryCtx,
  { gameMap }: { gameMap: GameMap },
): Promise<GameMapWithContent> => {
  const [ancestors, rawPins] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: gameMap.parentId,
      isTrashed: gameMap.isTrashed,
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

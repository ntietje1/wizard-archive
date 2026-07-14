import { asyncMap } from 'convex-helpers'
import { enhanceCanvas } from '../../canvases/functions/enhanceCanvas'
import { enhanceFile } from '../../files/functions/enhanceFile'
import { enhanceFolder } from '../../folders/functions/enhanceFolder'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  AnyResource,
  AnyResourceRow,
} from '@wizard-archive/editor/resources/resource-contract'
import { enhanceNote } from '../../notes/functions/enhanceNote'
import { assertNever } from '../../common/types'
import { mapPinRowToDomain } from './mapPinRow'
import type { CampaignQueryCtx } from '../../functions'
import type {
  MapItemRow,
  MapItem,
  MapItemWithContent,
  MapPinWithItem,
} from '@wizard-archive/editor/game-maps/item-contract'
import type { MapPin } from '@wizard-archive/editor/game-maps/document-contract'
import type { SidebarItemEnhancement } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { getStorageIdByAssetId } from '../../storage/functions/assetIdentity'

export const enhanceGameMap = async (
  ctx: CampaignQueryCtx,
  { gameMap, enhancement }: { gameMap: MapItemRow; enhancement?: SidebarItemEnhancement },
): Promise<MapItem> => {
  const imageStorageId = await getStorageIdByAssetId(ctx.db, gameMap.imageAssetId)
  const [base, imageUrl, layers] = await Promise.all([
    enhanceBase(ctx, { item: gameMap, enhancement }),
    imageStorageId ? ctx.storage.getUrl(imageStorageId) : null,
    gameMap.layers
      ? asyncMap(gameMap.layers, async (layer) => {
          const storageId = await getStorageIdByAssetId(ctx.db, layer.imageAssetId)
          return {
            id: layer.id,
            imageAssetId: layer.imageAssetId,
            imageUrl: storageId ? await ctx.storage.getUrl(storageId) : null,
            name: layer.name,
          }
        })
      : undefined,
  ])

  const { layers: _baseLayers, ...baseFields } = base

  return {
    ...baseFields,
    ...(layers ? { layers } : {}),
    imageUrl,
  }
}

const enhanceMapPin = async (
  ctx: CampaignQueryCtx,
  { pin }: { pin: MapPin },
): Promise<MapPinWithItem | null> => {
  const item = await getSidebarItem(ctx, pin.itemId)
  if (!item) return null
  const permissionLevel = await getSidebarItemPermissionLevel(ctx, { item })
  if (!hasAtLeastPermissionLevel(permissionLevel, PERMISSION_LEVEL.VIEW)) {
    return {
      ...pin,
      item: null,
    }
  }
  const enhancedItem = await enhancePinnedItem(ctx, { item })
  return {
    ...pin,
    item: enhancedItem,
  }
}

const enhancePinnedItem = async (
  ctx: CampaignQueryCtx,
  { item }: { item: AnyResourceRow },
): Promise<AnyResource> => {
  switch (item.type) {
    case RESOURCE_TYPES.files:
      return enhanceFile(ctx, { file: item })
    case RESOURCE_TYPES.gameMaps:
      return enhanceGameMap(ctx, { gameMap: item })
    case RESOURCE_TYPES.folders:
      return enhanceFolder(ctx, { folder: item })
    case RESOURCE_TYPES.notes:
      return enhanceNote(ctx, { note: item })
    case RESOURCE_TYPES.canvases:
      return enhanceCanvas(ctx, { canvas: item })
    default:
      return assertNever(item)
  }
}

export const enhanceGameMapWithContent = async (
  ctx: CampaignQueryCtx,
  { gameMap }: { gameMap: MapItem },
): Promise<MapItemWithContent> => {
  const [ancestors, rawPins] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: gameMap.parentId,
      isTrashed: gameMap.isTrashed,
    }),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', gameMap.id))
      .collect(),
  ])

  const pins = (
    await asyncMap(rawPins.map(mapPinRowToDomain), (pin) => enhanceMapPin(ctx, { pin }))
  ).filter((pin) => pin !== null)

  return {
    ...gameMap,
    ancestors,
    pins,
  }
}

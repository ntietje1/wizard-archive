import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { logger } from '../../common/logger'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { readGameMapSnapshot } from '@wizard-archive/editor/game-maps/document-contract'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import { getStorageIdByAssetId } from '../../storage/functions/assetIdentity'
import { findSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'

export async function rollbackGameMap(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const parsed = readGameMapSnapshot(snapshotData)
  if (!parsed) throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Invalid game map snapshot')

  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  const map = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (map.type !== RESOURCE_TYPES.gameMaps) {
    throw new Error(`rollbackMap: expected a map but got ${String(map.type)}`)
  }

  await restoreMapImages(ctx, itemId, parsed)
  await ctx.db.patch('sidebarItems', itemId, { previewStorageId: null })
  await replaceMapPins(ctx, itemId, parsed.pins)
}

async function restoreMapImages(
  ctx: CampaignMutationCtx,
  mapId: Id<'sidebarItems'>,
  snapshot: GameMapSnapshotData,
) {
  const ext = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
    .unique()
  if (!ext) return
  const [imageStorageId, layers] = await Promise.all([
    getStorageIdByAssetId(ctx.db, snapshot.imageAssetId),
    snapshot.layers
      ? asyncMap(snapshot.layers, async (layer) => ({
          id: layer.id,
          imageStorageId: await getStorageIdByAssetId(ctx.db, layer.imageAssetId),
          name: layer.name,
        }))
      : undefined,
  ])
  await ctx.db.patch('gameMaps', ext._id, {
    imageStorageId,
    ...(layers ? { layers } : { layers: undefined }),
  })
}

async function replaceMapPins(
  ctx: CampaignMutationCtx,
  mapId: Id<'sidebarItems'>,
  pins: GameMapSnapshotData['pins'],
) {
  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()

  await asyncMap(existingPins, (pin) => ctx.db.delete('mapPins', pin._id))

  const pinTargetChecks = await asyncMap(pins, async (pin) => {
    const item = await findSidebarItemRow(ctx, pin.itemId)
    return { pin, item: item && isActiveSidebarItem(item) ? item : null }
  })
  const validPins = pinTargetChecks.flatMap(({ pin, item }) => (item ? [{ pin, item }] : []))
  const skippedCount = pinTargetChecks.length - validPins.length
  if (skippedCount > 0) {
    const skippedIds = pinTargetChecks.flatMap(({ pin, item }) => (item ? [] : [pin.itemId]))
    logger.warn(
      `rollbackGameMap: skipped ${skippedCount} pins with missing targets: ${skippedIds.join(', ')}`,
    )
  }

  await asyncMap(validPins, ({ pin, item }) =>
    ctx.db.insert('mapPins', {
      mapPinUuid: pin.id,
      mapId,
      itemId: item._id,
      layerId: pin.layerId ?? null,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
    }),
  )
}

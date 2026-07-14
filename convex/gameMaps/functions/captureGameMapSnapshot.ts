import { asyncMap } from 'convex-helpers'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { uint8ToArrayBuffer } from '../../../shared/yjs-sync/uint8ToArrayBuffer'
import { createSnapshot } from '../../documentSnapshots/functions/createSnapshot'
import { logger } from '../../common/logger'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import { DOCUMENT_SNAPSHOT_TYPE } from '../../documentSnapshots/types'
import { getAssetIdByStorageId } from '../../storage/functions/assetIdentity'
import { sidebarItemResourceId } from '../../sidebarItems/functions/sidebarItemIdentity'

export async function encodeGameMapSnapshot(
  ctx: QueryCtx,
  {
    mapId,
    campaignId,
  }: {
    mapId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
  },
): Promise<ArrayBuffer> {
  const [sidebarItem, map, pins] = await Promise.all([
    ctx.db.get('sidebarItems', mapId),
    ctx.db
      .query('gameMaps')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
      .unique(),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
      .order('asc')
      .collect(),
  ])

  if (!sidebarItem) {
    throw new Error(`sidebarItem not found for mapId ${mapId}`)
  }
  if (sidebarItem.campaignId !== campaignId) {
    throw new Error(
      `campaignId mismatch for mapId ${mapId} (possible auth issue) expected ${campaignId} got ${sidebarItem.campaignId}`,
    )
  }
  if (!map) {
    throw new Error(`map not found for mapId ${mapId}`)
  }

  const pinItems = await asyncMap(pins, (pin) => ctx.db.get('sidebarItems', pin.itemId))

  const validPins: Array<{
    pin: (typeof pins)[number]
    item: NonNullable<(typeof pinItems)[number]>
  }> = []
  for (let i = 0; i < pins.length; i++) {
    const item = pinItems[i]
    if (!item) {
      logger.warn(
        `captureGameMapSnapshot: pin target ${pins[i].itemId} not found for map ${mapId}, skipping`,
      )
      continue
    }
    validPins.push({ pin: pins[i], item })
  }

  const [imageAssetId, layers] = await Promise.all([
    getAssetIdByStorageId(ctx.db, map.imageStorageId),
    map.layers
      ? asyncMap(map.layers, async (layer) => ({
          id: layer.id,
          imageAssetId: await getAssetIdByStorageId(ctx.db, layer.imageStorageId),
          name: layer.name,
        }))
      : undefined,
  ])

  const snapshotData: GameMapSnapshotData = {
    imageAssetId,
    ...(layers ? { layers } : {}),
    pins: validPins.map(({ pin, item }) => ({
      id: pin.mapPinUuid,
      itemId: sidebarItemResourceId(item),
      layerId: pin.layerId ?? null,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
      name: item.name ?? null,
      color: item.color ?? null,
      iconName: item.iconName ?? null,
      itemType: item.type ?? null,
    })),
  }

  return uint8ToArrayBuffer(new TextEncoder().encode(JSON.stringify(snapshotData)))
}

export async function captureGameMapSnapshot(
  ctx: MutationCtx,
  {
    mapId,
    editHistoryId,
    campaignId,
  }: {
    mapId: Id<'sidebarItems'>
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
  },
): Promise<void> {
  const data = await encodeGameMapSnapshot(ctx, { mapId, campaignId })

  await createSnapshot(ctx, {
    itemId: mapId,
    itemType: RESOURCE_TYPES.gameMaps,
    editHistoryId,
    campaignId,
    snapshotType: DOCUMENT_SNAPSHOT_TYPE.GameMap,
    data,
  })
}

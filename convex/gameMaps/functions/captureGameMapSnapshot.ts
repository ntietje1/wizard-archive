import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { GAME_MAP_SNAPSHOT_TYPE } from '../types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { createSnapshot } from '../../documentSnapshots/functions/createSnapshot'
import { logger } from '../../common/logger'
import type { GameMapSnapshotData } from '../types'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function captureGameMapSnapshot(
  ctx: MutationCtx,
  {
    mapId,
    editHistoryId,
    campaignId,
    createdBy,
  }: {
    mapId: Id<'sidebarItems'>
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    createdBy: Id<'userProfiles'>
  },
): Promise<void> {
  const [map, pins] = await Promise.all([
    getSidebarItem<'gameMaps'>(ctx, mapId),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_deletionTime', (q) => q.eq('mapId', mapId).eq('deletionTime', null))
      .order('asc')
      .collect(),
  ])

  if (!map) {
    throw new Error(`captureGameMapSnapshot: map ${mapId} not found`)
  }

  const pinItems = await Promise.all(pins.map((pin) => ctx.db.get('sidebarItems', pin.itemId)))

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

  const snapshotData: GameMapSnapshotData = {
    imageStorageId: map.imageStorageId,
    pins: validPins.map(({ pin, item }) => ({
      itemId: pin.itemId,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
      name: item.name ?? null,
      color: item.color ?? null,
      iconName: item.iconName ?? null,
      itemType: item.type ?? null,
    })),
  }

  const json = JSON.stringify(snapshotData)
  const data = uint8ToArrayBuffer(new TextEncoder().encode(json))

  await createSnapshot(ctx, {
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    editHistoryId,
    campaignId,
    snapshotType: GAME_MAP_SNAPSHOT_TYPE,
    data,
    createdBy,
  })
}

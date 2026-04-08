import { GAME_MAP_SNAPSHOT_TYPE } from '../types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { createSnapshot } from '../../documentSnapshots/functions/createSnapshot'
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
    mapId: Id<'gameMaps'>
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    createdBy: Id<'userProfiles'>
  },
): Promise<void> {
  const [map, pins] = await Promise.all([
    ctx.db.get(mapId),
    ctx.db
      .query('mapPins')
      .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect(),
  ])

  if (!map) {
    console.warn(
      `captureGameMapSnapshot: map ${mapId} not found, skipping snapshot`,
    )
    return
  }

  const pinItems = await Promise.all(pins.map((pin) => ctx.db.get(pin.itemId)))

  const snapshotData: GameMapSnapshotData = {
    imageStorageId: map.imageStorageId,
    pins: pins.map((pin, i) => {
      const item = pinItems[i]
      return {
        itemId: pin.itemId,
        x: pin.x,
        y: pin.y,
        visible: pin.visible,
        name: item?.name ?? null,
        color: item?.color ?? null,
        iconName: item?.iconName ?? null,
        itemType: item?.type ?? null,
      }
    }),
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

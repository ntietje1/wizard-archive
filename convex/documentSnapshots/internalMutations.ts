import * as Y from 'yjs'
import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { sidebarItemTypeValidator } from '../sidebarItems/schema/baseValidators'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { reconstructYDoc } from '../yjsSync/functions/reconstructYDoc'
import { uint8ToArrayBuffer } from '../yjsSync/functions/uint8ToArrayBuffer'
import { SNAPSHOT_TYPE } from './schema'
import { createSnapshot } from './functions/createSnapshot'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { SidebarItemType } from '../sidebarItems/types/baseTypes'
import type { GameMapSnapshotData } from './types'

export async function captureYjsSnapshotInline(
  ctx: MutationCtx,
  {
    documentId,
    itemType,
    editHistoryId,
    campaignId,
    createdBy,
  }: {
    documentId: Id<'notes'> | Id<'canvases'>
    itemType: SidebarItemType
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    createdBy: Id<'userProfiles'>
  },
): Promise<void> {
  const { doc } = await reconstructYDoc(ctx, documentId)

  try {
    const encoded = Y.encodeStateAsUpdate(doc)
    await createSnapshot(ctx, {
      itemId: documentId,
      itemType,
      editHistoryId,
      campaignId,
      snapshotType: SNAPSHOT_TYPE.yjs_state,
      data: uint8ToArrayBuffer(encoded),
      createdBy,
    })
  } finally {
    doc.destroy()
  }
}

export async function captureGameMapSnapshotInline(
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
      `captureGameMapSnapshotInline: map ${mapId} not found, skipping snapshot`,
    )
    return
  }

  const snapshotData: GameMapSnapshotData = {
    imageStorageId: map.imageStorageId,
    pins: pins.map((pin) => ({
      itemId: pin.itemId,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
    })),
  }

  const json = JSON.stringify(snapshotData)
  const data = uint8ToArrayBuffer(new TextEncoder().encode(json))

  await createSnapshot(ctx, {
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    editHistoryId,
    campaignId,
    snapshotType: SNAPSHOT_TYPE.game_map,
    data,
    createdBy,
  })
}

export const captureYjsSnapshot = internalMutation({
  args: {
    documentId: v.union(v.id('notes'), v.id('canvases')),
    itemType: sidebarItemTypeValidator,
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    createdBy: v.id('userProfiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await captureYjsSnapshotInline(ctx, args)
  },
})

export const captureGameMapSnapshot = internalMutation({
  args: {
    mapId: v.id('gameMaps'),
    editHistoryId: v.id('editHistory'),
    campaignId: v.id('campaigns'),
    createdBy: v.id('userProfiles'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await captureGameMapSnapshotInline(ctx, args)
  },
})

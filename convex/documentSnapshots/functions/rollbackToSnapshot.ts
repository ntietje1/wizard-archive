import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import { requireCampaignMembership } from '../../functions'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SNAPSHOT_TYPE } from '../schema'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { GameMapSnapshotData } from '../types'

export async function rollbackToSnapshot(
  ctx: AuthMutationCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<void> {
  const historyEntry = await ctx.db.get(editHistoryId)
  if (!historyEntry) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'History entry not found')
  }

  const itemFromDb = await ctx.db.get(historyEntry.itemId)
  await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })
  const { membership } = await requireCampaignMembership(
    ctx,
    historyEntry.campaignId,
  )

  const snapshot = await ctx.db
    .query('documentSnapshots')
    .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
    .first()

  if (!snapshot) {
    throwClientError(
      ERROR_CODE.NOT_FOUND,
      'No snapshot found for this history entry',
    )
  }

  switch (snapshot.snapshotType) {
    case SNAPSHOT_TYPE.yjs_state:
      await resetYjsDocument(
        ctx,
        historyEntry.itemId as Id<'notes'> | Id<'canvases'>,
        snapshot.data,
      )
      break
    case SNAPSHOT_TYPE.game_map:
      await rollbackGameMap(
        ctx,
        historyEntry.itemId as Id<'gameMaps'>,
        snapshot.data,
      )
      break
    default:
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Unsupported snapshot type: ${snapshot.snapshotType}`,
      )
  }

  const now = Date.now()
  const profileId = ctx.user.profile._id

  await ctx.db.patch(historyEntry.itemId, {
    updatedTime: now,
    updatedBy: profileId,
  })

  await ctx.db.insert('editHistory', {
    itemId: historyEntry.itemId,
    itemType: historyEntry.itemType,
    campaignId: historyEntry.campaignId,
    campaignMemberId: membership._id,
    action: EDIT_HISTORY_ACTION.rolled_back,
    metadata: { restoredFromHistoryEntryId: editHistoryId },
    hasSnapshot: false,
  })
}

async function resetYjsDocument(
  ctx: AuthMutationCtx,
  documentId: Id<'notes'> | Id<'canvases'>,
  snapshotData: ArrayBuffer,
): Promise<void> {
  const existingUpdates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .collect()

  await Promise.all(existingUpdates.map((row) => ctx.db.delete(row._id)))

  await ctx.db.insert('yjsUpdates', {
    documentId,
    update: snapshotData,
    seq: 0,
    isSnapshot: true,
  })
}

async function rollbackGameMap(
  ctx: AuthMutationCtx,
  mapId: Id<'gameMaps'>,
  data: ArrayBuffer,
): Promise<void> {
  let snapshotData: GameMapSnapshotData
  try {
    snapshotData = JSON.parse(new TextDecoder().decode(data))
  } catch (e) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Failed to parse game map snapshot: ${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }

  const map = await ctx.db.get(mapId)
  if (!map) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')

  await ctx.db.patch(mapId, {
    imageStorageId: snapshotData.imageStorageId as Id<'_storage'> | null,
    previewStorageId: snapshotData.imageStorageId as Id<'_storage'> | null,
  })

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const now = Date.now()
  const profileId = ctx.user.profile._id

  await Promise.all(
    existingPins.map((pin) =>
      ctx.db.patch(pin._id, { deletionTime: now, deletedBy: profileId }),
    ),
  )

  const pinTargetChecks = await Promise.all(
    snapshotData.pins.map(async (pin) => ({
      pin,
      exists: (await ctx.db.get(pin.itemId)) !== null,
    })),
  )
  const validPins = pinTargetChecks.filter((p) => p.exists).map((p) => p.pin)

  await Promise.all(
    validPins.map((pin) =>
      ctx.db.insert('mapPins', {
        mapId,
        itemId: pin.itemId,
        x: pin.x,
        y: pin.y,
        visible: pin.visible,
        createdBy: profileId,
        updatedTime: null,
        updatedBy: null,
        deletionTime: null,
        deletedBy: null,
      }),
    ),
  )
}

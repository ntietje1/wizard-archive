import { ERROR_CODE, throwClientError } from '../../errors'
import type { GameMapSnapshotData } from '../types'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Id } from '../../_generated/dataModel'

export async function rollbackGameMap(
  ctx: AuthMutationCtx,
  itemId: SidebarItemId,
  snapshotData: ArrayBuffer,
): Promise<void> {
  let parsed: GameMapSnapshotData
  try {
    parsed = JSON.parse(new TextDecoder().decode(snapshotData))
  } catch (e) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Failed to parse game map snapshot: ${e instanceof Error ? e.message : 'unknown error'}`,
    )
  }

  const mapId = itemId as Id<'gameMaps'>
  const map = await ctx.db.get(mapId)
  if (!map) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')

  await ctx.db.patch(mapId, {
    imageStorageId: parsed.imageStorageId as Id<'_storage'> | null,
    previewStorageId: parsed.imageStorageId as Id<'_storage'> | null,
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
    parsed.pins.map(async (pin) => ({
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

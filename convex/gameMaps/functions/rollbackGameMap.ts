import { ERROR_CODE, throwClientError } from '../../errors'
import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logger } from '../../common/logger'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { GameMapSnapshotData } from '../types'
import type { AuthMutationCtx } from '../../functions'
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

  if (!Array.isArray(parsed.pins)) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Invalid game map snapshot: missing or malformed pins array',
    )
  }

  for (let i = 0; i < parsed.pins.length; i++) {
    const pin = parsed.pins[i]
    if (
      !pin ||
      typeof pin.itemId !== 'string' ||
      typeof pin.x !== 'number' ||
      typeof pin.y !== 'number' ||
      typeof pin.visible !== 'boolean'
    ) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Invalid game map snapshot: malformed pin at index ${i}`,
      )
    }
  }

  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  const map = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (map.type !== SIDEBAR_ITEM_TYPES.gameMaps) {
    throw new Error(`rollbackMap: expected a map but got ${String(map.type)}`)
  }

  const ext = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', map._id))
    .unique()
  if (ext) {
    await ctx.db.patch('gameMaps', ext._id, {
      imageStorageId: parsed.imageStorageId as Id<'_storage'> | null,
    })
  }

  await ctx.db.patch('sidebarItems', map._id, {
    previewStorageId: null,
  })

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_deletionTime', (q) => q.eq('mapId', map._id).eq('deletionTime', null))
    .collect()

  const now = Date.now()
  const profileId = ctx.user.profile._id

  await Promise.all(
    existingPins.map((pin) =>
      ctx.db.patch('mapPins', pin._id, { deletionTime: now, deletedBy: profileId }),
    ),
  )

  const pinTargetChecks = await Promise.all(
    parsed.pins.map(async (pin) => {
      try {
        const item = await ctx.db.get('sidebarItems', pin.itemId)
        return { pin, exists: item !== null && !item.deletionTime }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('Invalid ID') || message.includes('not found')) {
          return { pin, exists: false }
        }
        logger.warn(
          `rollbackGameMap: unexpected error checking pin target ${pin.itemId}: ${message}`,
        )
        throw e
      }
    }),
  )
  const validPins = pinTargetChecks.filter((p) => p.exists).map((p) => p.pin)
  const skippedCount = pinTargetChecks.length - validPins.length
  if (skippedCount > 0) {
    const skippedIds = pinTargetChecks.filter((p) => !p.exists).map((p) => p.pin.itemId)
    logger.warn(
      `rollbackGameMap: skipped ${skippedCount} pins with missing targets: ${skippedIds.join(', ')}`,
    )
  }

  await Promise.all(
    validPins.map((pin) =>
      ctx.db.insert('mapPins', {
        mapId: map._id,
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

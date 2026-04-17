import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { requireItemAccess } from '../../sidebarItems/validation/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logger } from '../../common/logger'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { GameMapSnapshotData } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function rollbackGameMap(
  ctx: CampaignMutationCtx,
  itemId: Id<'sidebarItems'>,
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
    .withIndex('by_map_item', (q) => q.eq('mapId', map._id))
    .collect()

  await asyncMap(existingPins, (pin) => ctx.db.delete('mapPins', pin._id))

  const pinTargetChecks = await asyncMap(parsed.pins, async (pin) => {
    try {
      const item = await ctx.db.get('sidebarItems', pin.itemId)
      return { pin, exists: item !== null && !item.deletionTime }
    } catch {
      return { pin, exists: false }
    }
  })
  const validPins = pinTargetChecks.filter((p) => p.exists).map((p) => p.pin)
  const skippedCount = pinTargetChecks.length - validPins.length
  if (skippedCount > 0) {
    const skippedIds = pinTargetChecks.filter((p) => !p.exists).map((p) => p.pin.itemId)
    logger.warn(
      `rollbackGameMap: skipped ${skippedCount} pins with missing targets: ${skippedIds.join(', ')}`,
    )
  }

  await asyncMap(validPins, (pin) =>
    ctx.db.insert('mapPins', {
      mapId: map._id,
      itemId: pin.itemId,
      x: pin.x,
      y: pin.y,
      visible: pin.visible,
    }),
  )
}

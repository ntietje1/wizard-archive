import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { validatePinTarget } from '../validation'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createItemPin(
  ctx: CampaignMutationCtx,
  {
    mapId,
    x,
    y,
    itemId,
  }: {
    mapId: Id<'sidebarItems'>
    x: number
    y: number
    itemId: Id<'sidebarItems'>
  },
): Promise<Id<'mapPins'>> {
  const rawItem = await getSidebarItem(ctx, mapId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const item = await ctx.db.get('sidebarItems', itemId)
  if (!item) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (item.campaignId !== rawItem.campaignId) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Item must belong to the same campaign as the map',
    )
  }

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()
  const existingPinItemIds = existingPins.map((p) => p.itemId)

  const validationError = validatePinTarget(mapId, itemId, existingPinItemIds)
  if (validationError) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, validationError)
  }

  const userId = ctx.membership.userId

  const pinId = await ctx.db.insert('mapPins', {
    mapId: mapId,
    itemId: itemId,
    x,
    y,
    visible: false,
  })

  await ctx.db.patch('sidebarItems', mapId, {
    updatedTime: Date.now(),
    updatedBy: userId,
  })

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_added,
      metadata: { pinItemName: item.name },
    },
    { hasSnapshot: false },
  )

  try {
    await captureGameMapSnapshot(ctx, {
      mapId,
      editHistoryId,
      campaignId: rawItem.campaignId,
    })
    await ctx.db.patch('editHistory', editHistoryId, { hasSnapshot: true })
  } catch (error) {
    logger.warn(`createItemPin: failed to capture snapshot for map ${mapId}`, error)
  }

  return pinId
}

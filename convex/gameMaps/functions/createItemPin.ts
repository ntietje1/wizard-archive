import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { ERROR_CODE, throwClientError } from '../../errors'
import { validatePinTarget } from '../validation'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function createItemPin(
  ctx: AuthMutationCtx,
  {
    mapId,
    x,
    y,
    itemId,
  }: {
    mapId: Id<'gameMaps'>
    x: number
    y: number
    itemId: SidebarItemId
  },
): Promise<Id<'mapPins'>> {
  const mapFromDb = await ctx.db.get(mapId)
  if (!mapFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireCampaignMembership(ctx, mapFromDb.campaignId)
  await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const item = await ctx.db.get(itemId)
  if (!item) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (item.campaignId !== mapFromDb.campaignId) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Item must belong to the same campaign as the map',
    )
  }

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()
  const existingPinItemIds = existingPins.map((p) => p.itemId)

  const validationError = validatePinTarget(mapId, itemId, existingPinItemIds)
  if (validationError) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, validationError)
  }

  const profileId = ctx.user.profile._id

  const pinId = await ctx.db.insert('mapPins', {
    mapId,
    itemId,
    x,
    y,
    visible: false,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  await ctx.db.patch(mapId, {
    updatedTime: Date.now(),
    updatedBy: profileId,
  })

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: mapFromDb.campaignId,
      action: EDIT_HISTORY_ACTION.map_pin_added,
      metadata: { pinItemName: item.name },
    },
    { hasSnapshot: false },
  )

  try {
    await captureGameMapSnapshot(ctx, {
      mapId,
      editHistoryId,
      campaignId: mapFromDb.campaignId,
      createdBy: profileId,
    })
    await ctx.db.patch(editHistoryId, { hasSnapshot: true })
  } catch (error) {
    logger.warn(`createItemPin: failed to capture snapshot for map ${mapId}`, error)
  }

  return pinId
}

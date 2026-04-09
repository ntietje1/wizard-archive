import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updateItemPin(
  ctx: AuthMutationCtx,
  {
    mapPinId,
    x,
    y,
  }: {
    mapPinId: Id<'mapPins'>
    x: number
    y: number
  },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  await ctx.db.patch("mapPins", mapPinId, {
    x,
    y,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  // eslint-disable-next-line @convex-dev/explicit-table-ids -- pin.itemId is a polymorphic SidebarItemId
  const pinnedItem = await ctx.db.get(pin.itemId)
  if (!pinnedItem) {
    logger.warn(`Pin ${mapPinId} references missing item ${pin.itemId}`)
  }

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: map._id,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: map.campaignId,
      action: EDIT_HISTORY_ACTION.map_pin_moved,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown' },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshot(ctx, {
    mapId: map._id,
    editHistoryId,
    campaignId: map.campaignId,
    createdBy: ctx.user.profile._id,
  })

  return mapPinId
}

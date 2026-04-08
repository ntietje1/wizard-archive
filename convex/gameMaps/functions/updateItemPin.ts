import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
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

  await ctx.db.patch(mapPinId, {
    x,
    y,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  const pinnedItem = await ctx.db.get(pin.itemId)

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

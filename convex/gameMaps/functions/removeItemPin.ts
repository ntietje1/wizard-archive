import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function removeItemPin(
  ctx: AuthMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  const now = Date.now()
  await ctx.db.patch(mapPinId, {
    deletionTime: now,
    deletedBy: ctx.user.profile._id,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  const pinnedItem = await ctx.db.get(pin.itemId)
  await logEditHistory(ctx, {
    itemId: map._id,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    campaignId: map.campaignId,
    action: EDIT_HISTORY_ACTION.pin_removed,
    metadata: { pinItemName: pinnedItem?.name ?? 'Unknown' },
  })

  return mapPinId
}

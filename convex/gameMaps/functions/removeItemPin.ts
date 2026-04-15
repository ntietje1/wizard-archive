import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { requirePinAccess } from './requirePinAccess'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function removeItemPin(
  ctx: CampaignMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  await ctx.db.delete('mapPins', mapPinId)

  await ctx.db.patch('sidebarItems', map._id, {
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  const pinnedItem = await ctx.db.get('sidebarItems', pin.itemId)

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: map._id,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_removed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown' },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshot(ctx, {
    mapId: map._id,
    editHistoryId,
    campaignId: map.campaignId,
  })

  return mapPinId
}

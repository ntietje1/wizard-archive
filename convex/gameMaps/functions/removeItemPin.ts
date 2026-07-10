import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
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

  await ctx.db.patch('sidebarItems', map.id, {
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  const pinnedItem = await ctx.db.get('sidebarItems', pin.itemId)

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: map.id,
      itemType: RESOURCE_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_removed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown' },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshot(ctx, {
    mapId: map.id,
    editHistoryId,
    campaignId: map.campaignId,
  })

  return mapPinId
}

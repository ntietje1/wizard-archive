import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { requirePinAccess } from './requirePinAccess'
import type { CampaignMutationCtx } from '../../functions'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'

export async function updatePinVisibility(
  ctx: CampaignMutationCtx,
  { mapPinId, visible }: { mapPinId: MapPinId; visible: boolean },
): Promise<MapPinId> {
  const { pin, pinRowId, mapRowId } = await requirePinAccess(ctx, { mapPinId })

  if (visible === pin.visible) return mapPinId

  const pinnedItem = await ctx.db.get('sidebarItems', pin.itemId)

  if (!pinnedItem) {
    logger.warn(`Pin ${mapPinId} references missing item ${pin.itemId}`)
  }

  const now = Date.now()
  await ctx.db.patch('mapPins', pinRowId, {
    visible,
  })

  await ctx.db.patch('sidebarItems', mapRowId, {
    updatedTime: now,
    updatedBy: ctx.membership.userId,
  })

  const historyEntry = await logEditHistory(
    ctx,
    {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_visibility_changed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown', visible },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshot(ctx, {
    mapId: mapRowId,
    editHistoryId: historyEntry.rowId,
    campaignId: ctx.campaign._id,
  })

  return mapPinId
}

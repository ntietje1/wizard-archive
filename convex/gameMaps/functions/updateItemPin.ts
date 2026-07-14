import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { assertPinCoordinate } from './pinCoordinates'
import { requirePinAccess } from './requirePinAccess'
import type { CampaignMutationCtx } from '../../functions'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'

export async function updateItemPin(
  ctx: CampaignMutationCtx,
  {
    mapPinId,
    x,
    y,
  }: {
    mapPinId: MapPinId
    x: number
    y: number
  },
): Promise<MapPinId> {
  const { pin, pinRowId, map } = await requirePinAccess(ctx, { mapPinId })
  assertPinCoordinate(x, 'x')
  assertPinCoordinate(y, 'y')

  await ctx.db.patch('mapPins', pinRowId, {
    x,
    y,
  })

  const pinnedItem = await ctx.db.get('sidebarItems', pin.itemId)
  if (!pinnedItem) {
    logger.warn(`Pin ${mapPinId} references missing item ${pin.itemId}`)
  }

  const historyEntry = await logEditHistory(
    ctx,
    {
      itemId: map.id,
      itemType: RESOURCE_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_moved,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown' },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshot(ctx, {
    mapId: map.id,
    editHistoryId: historyEntry.rowId,
    campaignId: map.campaignId,
  })

  return mapPinId
}

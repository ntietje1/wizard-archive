import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { requirePinAccess } from './requirePinAccess'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: CampaignMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  if (visible === pin.visible) return mapPinId

  const pinnedItem = await ctx.db.get('sidebarItems', pin.itemId)

  if (!pinnedItem) {
    logger.warn(`Pin ${mapPinId} references missing item ${pin.itemId}`)
  }

  const now = Date.now()
  await ctx.db.patch('mapPins', mapPinId, {
    visible,
  })

  await ctx.db.patch('sidebarItems', map.id, {
    updatedTime: now,
    updatedBy: ctx.membership.userId,
  })

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: map.id,
      itemType: RESOURCE_TYPES.gameMaps,
      action: EDIT_HISTORY_ACTION.map_pin_visibility_changed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown', visible },
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

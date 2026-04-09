import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logger } from '../../common/logger'
import { captureGameMapSnapshot } from './captureGameMapSnapshot'
import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: AuthMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  if (visible === pin.visible) return mapPinId

  // eslint-disable-next-line @convex-dev/explicit-table-ids -- pin.itemId is a polymorphic SidebarItemId
  const pinnedItem = await ctx.db.get(pin.itemId)

  if (!pinnedItem) {
    logger.warn(`Pin ${mapPinId} references missing item ${pin.itemId}`)
  }

  const now = Date.now()
  await ctx.db.patch("mapPins", mapPinId, {
    visible,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  await ctx.db.patch("gameMaps", map._id, {
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  const editHistoryId = await logEditHistory(
    ctx,
    {
      itemId: map._id,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: map.campaignId,
      action: EDIT_HISTORY_ACTION.map_pin_visibility_changed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown', visible },
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

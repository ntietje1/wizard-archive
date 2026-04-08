import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { captureGameMapSnapshotInline } from '../../documentSnapshots/internalMutations'
import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: AuthMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  const { pin, map } = await requirePinAccess(ctx, { mapPinId })

  if (visible === pin.visible) return mapPinId

  await ctx.db.patch(mapPinId, {
    visible,
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
      action: EDIT_HISTORY_ACTION.map_pin_visibility_changed,
      metadata: { pinItemName: pinnedItem?.name ?? 'Unknown', visible },
    },
    { hasSnapshot: true },
  )

  await captureGameMapSnapshotInline(ctx, {
    mapId: map._id,
    editHistoryId,
    campaignId: map.campaignId,
    createdBy: ctx.user.profile._id,
  })

  return mapPinId
}

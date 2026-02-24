import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: CampaignMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  const pin = await ctx.db.get(mapPinId)
  if (!pin) {
    throw new Error('Pin not found')
  }

  const map = await ctx.db.get(pin.mapId)
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await ctx.db.patch(mapPinId, {
    visible,
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  })

  return mapPinId
}

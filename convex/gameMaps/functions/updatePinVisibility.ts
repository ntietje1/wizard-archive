import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: AuthMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  const pin = await ctx.db.get(mapPinId)
  if (!pin) {
    throw new Error('Pin not found')
  }

  const map = await ctx.db.get(pin.mapId)
  if (!map) throw new Error('Map not found')
  await requireCampaignMembership(ctx, map.campaignId)
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  await ctx.db.patch(mapPinId, {
    visible,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return mapPinId
}

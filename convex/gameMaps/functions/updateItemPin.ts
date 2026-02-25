import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updateItemPin(
  ctx: CampaignMutationCtx,
  {
    mapPinId,
    x,
    y,
  }: {
    mapPinId: Id<'mapPins'>
    x: number
    y: number
  },
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
    x,
    y,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return mapPinId
}

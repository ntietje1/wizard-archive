import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function removeItemPin(
  ctx: CampaignMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
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

  await ctx.db.delete(mapPinId)
  return mapPinId
}

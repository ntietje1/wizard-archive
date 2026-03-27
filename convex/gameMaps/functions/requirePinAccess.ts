import { requireItemAccess } from '../../sidebarItems/validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { GameMapFromDb, MapPin } from '../types'

export async function requirePinAccess(
  ctx: AuthMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
): Promise<{ pin: MapPin; map: GameMapFromDb }> {
  const pin = await ctx.db.get(mapPinId)
  if (!pin || pin.deletionTime !== null) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Pin not found')
  }

  const map = await ctx.db.get(pin.mapId)
  if (!map) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireCampaignMembership(ctx, map.campaignId)
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  return { pin, map }
}

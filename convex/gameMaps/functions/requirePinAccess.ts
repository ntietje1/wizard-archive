import { requireItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
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
  const pin = await ctx.db.get('mapPins', mapPinId)
  if (!pin || pin.deletionTime !== null) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Pin not found')
  }

  const rawItem = await ctx.db.get('sidebarItems', pin.mapId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireCampaignMembership(ctx, rawItem.campaignId)
  const map = (await loadSingleExtensionData(ctx, rawItem)) as GameMapFromDb
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  return { pin, map }
}

import { requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { GameMapFromDb, MapPin } from '../types'

export async function requirePinAccess(
  ctx: CampaignMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
): Promise<{ pin: MapPin; map: GameMapFromDb }> {
  const pin = await ctx.db.get('mapPins', mapPinId)
  if (!pin) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Pin not found')
  }

  const map = await getSidebarItem<'gameMaps'>(ctx, pin.mapId)
  if (!map) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  return { pin, map }
}

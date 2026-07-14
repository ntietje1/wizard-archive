import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'

export async function requirePinAccess(
  ctx: CampaignMutationCtx,
  { mapPinId }: { mapPinId: MapPinId },
): Promise<{
  pin: Doc<'mapPins'>
  pinRowId: Id<'mapPins'>
  mapRowId: Id<'sidebarItems'>
}> {
  const pinRow = await ctx.db
    .query('mapPins')
    .withIndex('by_mapPinUuid', (query) => query.eq('mapPinUuid', mapPinId))
    .unique()
  if (!pinRow) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Pin not found')
  }

  const map = await getSidebarItem(ctx, pinRow.mapId)
  if (!map || map.type !== RESOURCE_TYPES.gameMaps) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  }
  await requireItemAccess(ctx, {
    rawItem: map,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  return { pin: pinRow, pinRowId: pinRow._id, mapRowId: pinRow.mapId }
}

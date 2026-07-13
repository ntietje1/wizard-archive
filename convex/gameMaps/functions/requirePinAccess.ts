import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { mapPinRowToDomain } from './mapPinRow'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { MapItemRow } from '@wizard-archive/editor/game-maps/item-contract'
import type { MapPin } from '@wizard-archive/editor/game-maps/document-contract'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'

export async function requirePinAccess(
  ctx: CampaignMutationCtx,
  { mapPinId }: { mapPinId: MapPinId },
): Promise<{
  pin: MapPin
  pinRowId: Id<'mapPins'>
  map: MapItemRow
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

  return { pin: mapPinRowToDomain(pinRow), pinRowId: pinRow._id, map }
}

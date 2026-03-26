import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { ERROR_CODE, throwAppError } from '../../errors'
import { validatePinTarget } from '../validation'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function createItemPin(
  ctx: AuthMutationCtx,
  {
    mapId,
    x,
    y,
    itemId,
  }: {
    mapId: Id<'gameMaps'>
    x: number
    y: number
    itemId: SidebarItemId
  },
): Promise<Id<'mapPins'>> {
  const mapFromDb = await ctx.db.get(mapId)
  if (!mapFromDb) throw new Error('Map not found')
  await requireCampaignMembership(ctx, mapFromDb.campaignId)
  await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const item = await ctx.db.get(itemId)
  if (!item) {
    throw new Error('Item not found')
  }

  const existingPins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()
  const existingPinItemIds = existingPins.map((p) => p.itemId)

  const validationError = validatePinTarget(mapId, itemId, existingPinItemIds)
  if (validationError) {
    const code =
      (itemId as string) === (mapId as string)
        ? ERROR_CODE.VALIDATION_SELF_PIN
        : ERROR_CODE.VALIDATION_DUPLICATE_PIN
    throwAppError(code, validationError)
  }

  const profileId = ctx.user.profile._id

  return await ctx.db.insert('mapPins', {
    mapId,
    itemId,
    x,
    y,
    visible: false,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })
}

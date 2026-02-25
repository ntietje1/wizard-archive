import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function createItemPin(
  ctx: CampaignMutationCtx,
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
  await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const item = await ctx.db.get(itemId)
  if (!item) {
    throw new Error('Item not found')
  }

  const now = Date.now()
  const profileId = ctx.user.profile._id

  return await ctx.db.insert('mapPins', {
    mapId,
    itemId,
    x,
    y,
    visible: false,
    updatedTime: now,
    updatedBy: profileId,
    createdBy: profileId,
  })
}

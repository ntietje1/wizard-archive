import {
  requireItemAccess,
  validateSidebarMove,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function moveMap(
  ctx: CampaignMutationCtx,
  { mapId, parentId }: { mapId: Id<'gameMaps'>; parentId?: Id<'folders'> },
): Promise<Id<'gameMaps'>> {
  const mapFromDb = await ctx.db.get(mapId)
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await validateSidebarMove(ctx, { item: map, newParentId: parentId })

  await ctx.db.patch(mapId, {
    parentId: parentId ?? null,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })
  return map._id
}

import {
  requireItemAccess,
  validateSidebarMove,
} from '../validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { SidebarItemId } from '../types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function moveSidebarItem(
  ctx: CampaignMutationCtx,
  { itemId, parentId }: { itemId: SidebarItemId; parentId?: Id<'folders'> },
): Promise<SidebarItemId> {
  const itemFromDb = await ctx.db.get(itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await validateSidebarMove(ctx, { item, newParentId: parentId })

  await ctx.db.patch(itemId, {
    parentId: parentId ?? null,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return item._id
}

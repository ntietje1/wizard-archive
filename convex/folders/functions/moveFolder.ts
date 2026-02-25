import {
  requireItemAccess,
  validateSidebarMove,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function moveFolder(
  ctx: CampaignMutationCtx,
  { folderId, parentId }: { folderId: Id<'folders'>; parentId?: Id<'folders'> },
): Promise<Id<'folders'>> {
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await validateSidebarMove(ctx, { item: folder, newParentId: parentId })

  await ctx.db.patch(folderId, {
    parentId: parentId ?? null,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })
  return folder._id
}

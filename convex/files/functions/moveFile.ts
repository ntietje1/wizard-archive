import {
  requireItemAccess,
  validateSidebarMove,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function moveFile(
  ctx: CampaignMutationCtx,
  { fileId, parentId }: { fileId: Id<'files'>; parentId?: Id<'folders'> },
): Promise<Id<'files'>> {
  const fileFromDb = await ctx.db.get(fileId)
  const file = await requireItemAccess(ctx, {
    rawItem: fileFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await validateSidebarMove(ctx, { item: file, newParentId: parentId })

  await ctx.db.patch(fileId, {
    parentId,
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  })
  return file._id
}

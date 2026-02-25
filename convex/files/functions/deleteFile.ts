import { deleteSidebarItemShares } from '../../sidebarShares/functions/sidebarItemShareMutations'
import { deleteItemBookmarks } from '../../bookmarks/functions/deleteItemBookmarks'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function deleteFile(
  ctx: CampaignMutationCtx,
  { fileId }: { fileId: Id<'files'> },
): Promise<Id<'files'>> {
  const fileFromDb = await ctx.db.get(fileId)
  const file = await requireItemAccess(ctx, {
    rawItem: fileFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  if (file.storageId) {
    await ctx.storage.delete(file.storageId)
  }

  await Promise.all([
    deleteSidebarItemShares(ctx, { sidebarItemId: fileId }),
    deleteItemBookmarks(ctx, { sidebarItemId: fileId }),
  ])
  await ctx.db.delete(fileId)
  return file._id
}

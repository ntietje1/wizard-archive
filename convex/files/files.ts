import { checkItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteSidebarItemShares } from '../shares/itemShares'
import { deleteItemBookmarks } from '../bookmarks/functions/deleteItemBookmarks'
import { enhanceFileWithContent } from './helpers'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { FileWithContent } from './types'

export const getFile = async (
  ctx: CampaignQueryCtx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)
  const file = await checkItemAccess(ctx, rawFile, PERMISSION_LEVEL.VIEW)
  if (!file) return null
  return enhanceFileWithContent(ctx, file)
}

export async function deleteFile(
  ctx: CampaignMutationCtx,
  fileId: Id<'files'>,
): Promise<void> {
  const file = await ctx.db.get(fileId)
  if (!file) return

  if (file.storageId) {
    await ctx.storage.delete(file.storageId)
  }

  await deleteSidebarItemShares(ctx, fileId)
  await deleteItemBookmarks(ctx, fileId)
  await ctx.db.delete(fileId)
}

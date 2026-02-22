import { checkItemAccess } from '../sidebarItems/validation'
import { deleteItemSharesAndBookmarks } from '../sidebarItems/cascadeDelete'
import { PERMISSION_LEVEL } from '../shares/types'
import { enhanceFileWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
import type { MutationCtx } from '../_generated/server'
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
  ctx: MutationCtx,
  fileId: Id<'files'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const file = await ctx.db.get(fileId)
  if (!file) return

  if (file.storageId) {
    await ctx.storage.delete(file.storageId)
  }

  await deleteItemSharesAndBookmarks(ctx, campaignId, fileId)
  await ctx.db.delete(fileId)
}

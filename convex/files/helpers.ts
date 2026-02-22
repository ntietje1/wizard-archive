import { getSidebarItemAncestors } from '../folders/folders'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import type { CampaignQueryCtx } from '../functions'
import type { File, FileFromDb, FileWithContent } from './types'

export const enhanceFile = async (
  ctx: CampaignQueryCtx,
  file: FileFromDb,
): Promise<File> => {
  const [downloadUrl, bookmark, shares, storageMetadata, myPermissionLevel] =
    await Promise.all([
      file.storageId ? ctx.storage.getUrl(file.storageId) : null,
      getBookmark(ctx, file.campaignId, ctx.membership._id, file._id),
      getSidebarItemSharesForItem(ctx, file.campaignId, file._id),
      file.storageId ? ctx.db.system.get(file.storageId) : null,
      getSidebarItemPermissionLevel(ctx, file),
    ])

  return {
    ...file,
    downloadUrl,
    isBookmarked: !!bookmark,
    shares,
    contentType: storageMetadata?.contentType ?? null,
    myPermissionLevel,
  }
}

export const enhanceFileWithContent = async (
  ctx: CampaignQueryCtx,
  file: File,
): Promise<FileWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, file.parentId)
  return {
    ...file,
    ancestors,
  }
}

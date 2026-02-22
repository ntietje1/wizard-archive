import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { getSidebarItemAncestors } from './folders'
import type { CampaignQueryCtx } from '../functions'
import type { Folder, FolderFromDb, FolderWithContent } from './types'

export const enhanceFolder = async (
  ctx: CampaignQueryCtx,
  folder: FolderFromDb,
): Promise<Folder> => {
  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getBookmark(ctx, folder.campaignId, ctx.membership._id, folder._id),
    getSidebarItemSharesForItem(ctx, folder.campaignId, folder._id),
    getSidebarItemPermissionLevel(ctx, folder),
  ])

  return {
    ...folder,
    isBookmarked: !!bookmark,
    shares,
    myPermissionLevel,
  }
}

export const enhanceFolderWithContent = async (
  ctx: CampaignQueryCtx,
  folder: Folder,
): Promise<FolderWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, folder.parentId)
  return {
    ...folder,
    ancestors,
  }
}

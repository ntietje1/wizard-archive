import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import { getSidebarItemAncestors } from './getSidebarItemAncestors'
import type { CampaignQueryCtx } from '../../functions'
import type { Folder, FolderFromDb, FolderWithContent } from '../types'

export const enhanceFolder = async (
  ctx: CampaignQueryCtx,
  { folder }: { folder: FolderFromDb },
): Promise<Folder> => {
  return await enhanceBase(ctx, { item: folder })
}

export const enhanceFolderWithContent = async (
  ctx: CampaignQueryCtx,
  { folder }: { folder: Folder },
): Promise<FolderWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: folder.parentId,
    isTrashed: folder.location === SIDEBAR_ITEM_LOCATION.trash,
  })
  return {
    ...folder,
    ancestors,
  }
}

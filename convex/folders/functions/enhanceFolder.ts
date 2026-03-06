import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import { getSidebarItemAncestors } from './getSidebarItemAncestors'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Folder, FolderFromDb, FolderWithContent } from '../types'

export const enhanceFolder = async (
  ctx: AuthQueryCtx,
  {
    folder,
    sharesMap,
    bookmarkIds,
  }: {
    folder: FolderFromDb
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<Folder> => {
  return await enhanceBase(ctx, { item: folder, sharesMap, bookmarkIds })
}

export const enhanceFolderWithContent = async (
  ctx: AuthQueryCtx,
  { folder }: { folder: Folder },
): Promise<FolderWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: folder.parentId,
    isTrashed: !!folder.deletionTime,
  })
  return {
    ...folder,
    ancestors,
  }
}

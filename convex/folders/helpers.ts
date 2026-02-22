import { enhanceBase } from '../sidebarItems/enhanceBase'
import { getSidebarItemAncestors } from './folders'
import type { CampaignQueryCtx } from '../functions'
import type { Folder, FolderFromDb, FolderWithContent } from './types'

export const enhanceFolder = async (
  ctx: CampaignQueryCtx,
  folder: FolderFromDb,
): Promise<Folder> => {
  return enhanceBase(ctx, folder)
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

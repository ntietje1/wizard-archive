import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { getSidebarItemAncestors } from './getSidebarItemAncestors'
import type { CampaignQueryCtx } from '../../functions'
import type {
  FolderResourceRow,
  FolderResource,
  FolderResourceWithContent,
} from '@wizard-archive/editor/resources/resource-contract'
import type { SidebarItemEnhancement } from '../../sidebarItems/functions/enhanceBaseSidebarItem'

export const enhanceFolder = async (
  ctx: CampaignQueryCtx,
  { folder, enhancement }: { folder: FolderResourceRow; enhancement?: SidebarItemEnhancement },
): Promise<FolderResource> => {
  return await enhanceBase(ctx, { item: folder, enhancement })
}

export const enhanceFolderWithContent = async (
  ctx: CampaignQueryCtx,
  { folder }: { folder: FolderResource },
): Promise<FolderResourceWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: folder.parentId,
    isTrashed: folder.isTrashed,
  })
  return {
    ...folder,
    ancestors,
  }
}

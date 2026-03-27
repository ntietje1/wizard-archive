import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { FileFromDb, FileWithContent, SidebarFile } from '../types'

export const enhanceFile = async (
  ctx: AuthQueryCtx,
  {
    file,
    sharesMap,
    bookmarkIds,
  }: {
    file: FileFromDb
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<SidebarFile> => {
  const [base, downloadUrl, storageMetadata] = await Promise.all([
    enhanceBase(ctx, { item: file, sharesMap, bookmarkIds }),
    file.storageId ? ctx.storage.getUrl(file.storageId) : null,
    file.storageId ? ctx.db.system.get(file.storageId) : null,
  ])

  return {
    ...base,
    downloadUrl,
    contentType: storageMetadata?.contentType ?? null,
  }
}

export const enhanceFileWithContent = async (
  ctx: AuthQueryCtx,
  { file }: { file: SidebarFile },
): Promise<FileWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: file.parentId,
    isTrashed: file.location === SIDEBAR_ITEM_LOCATION.trash,
  })
  return {
    ...file,
    ancestors,
  }
}

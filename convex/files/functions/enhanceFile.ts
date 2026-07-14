import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type {
  FileItemWithContent,
  FileItem,
  FileItemRow,
} from '@wizard-archive/editor/files/item-contract'
import type { SidebarItemEnhancement } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { getStorageIdByAssetId } from '../../storage/functions/assetIdentity'

export const enhanceFile = async (
  ctx: CampaignQueryCtx,
  { file, enhancement }: { file: FileItemRow; enhancement?: SidebarItemEnhancement },
): Promise<FileItem> => {
  const storageId = await getStorageIdByAssetId(ctx.db, file.assetId)
  const [base, downloadUrl, storageMetadata] = await Promise.all([
    enhanceBase(ctx, { item: file, enhancement }),
    storageId ? ctx.storage.getUrl(storageId) : null,
    storageId ? ctx.db.system.get('_storage', storageId) : null,
  ])

  return {
    ...base,
    downloadUrl,
    contentType: storageMetadata?.contentType ?? null,
  }
}

export const enhanceFileWithContent = async (
  ctx: CampaignQueryCtx,
  { file }: { file: FileItem },
): Promise<FileItemWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: file.parentId,
    isTrashed: file.isTrashed,
  })
  return {
    ...file,
    ancestors,
  }
}

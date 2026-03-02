import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { FileFromDb, FileWithContent, SidebarFile } from '../types'

export const enhanceFile = async (
  ctx: CampaignQueryCtx,
  { file }: { file: FileFromDb },
): Promise<SidebarFile> => {
  const [base, downloadUrl, storageMetadata] = await Promise.all([
    enhanceBase(ctx, { item: file }),
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
  ctx: CampaignQueryCtx,
  { file }: { file: SidebarFile },
): Promise<FileWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: file.parentId,
    isTrashed: !!file.deletionTime,
  })
  return {
    ...file,
    ancestors,
  }
}

import { getSidebarItemAncestors } from '../folders/folders'
import { enhanceBase } from '../sidebarItems/enhanceBase'
import type { CampaignQueryCtx } from '../functions'
import type { File, FileFromDb, FileWithContent } from './types'

export const enhanceFile = async (
  ctx: CampaignQueryCtx,
  file: FileFromDb,
): Promise<File> => {
  const [base, downloadUrl, storageMetadata] = await Promise.all([
    enhanceBase(ctx, file),
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
  file: File,
): Promise<FileWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, file.parentId)
  return {
    ...file,
    ancestors,
  }
}

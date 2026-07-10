import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { FileItem } from '@wizard-archive/editor/files/item-contract'
import type { CampaignQueryCtx } from '../../functions'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import type { Id } from '../../_generated/dataModel'
import { logger } from '../../common/logger'

export async function getFileForDownload(
  ctx: CampaignQueryCtx,
  item: FileItem,
  path: string,
): Promise<DownloadItem> {
  let downloadUrl: string | null = null
  const storageId = item.assetId as unknown as Id<'_storage'> | null
  if (storageId) {
    try {
      downloadUrl = await ctx.storage.getUrl(storageId)
    } catch (error) {
      logger.warn(`getFileForDownload: failed to create URL for file ${item.id}`, error)
    }
  }

  return {
    type: RESOURCE_TYPES.files,
    name: item.name,
    path,
    downloadUrl,
  }
}

import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import type { CampaignQueryCtx } from '../../functions'
import type { AnySidebarItem } from '../../sidebarItems/types/types'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import { logger } from '../../common/logger'

export async function getFileForDownload(
  ctx: CampaignQueryCtx,
  item: Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.files }>,
  path: string,
): Promise<DownloadItem> {
  let downloadUrl: string | null = null
  if (item.storageId) {
    try {
      downloadUrl = await ctx.storage.getUrl(item.storageId)
    } catch (error) {
      logger.warn(`getFileForDownload: failed to create URL for file ${item._id}`, error)
    }
  }

  return {
    type: SIDEBAR_ITEM_TYPES.files,
    name: item.name,
    path,
    downloadUrl,
  }
}

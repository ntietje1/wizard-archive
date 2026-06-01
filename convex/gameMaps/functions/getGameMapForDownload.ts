import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import type { CampaignQueryCtx } from '../../functions'
import type { AnySidebarItem } from '../../sidebarItems/types/types'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'

export async function getGameMapForDownload(
  ctx: CampaignQueryCtx,
  item: Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.gameMaps }>,
  path: string,
): Promise<DownloadItem> {
  return {
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    name: item.name,
    path,
    downloadUrl: item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null,
  }
}

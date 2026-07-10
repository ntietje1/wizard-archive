import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { MapItem } from '@wizard-archive/editor/game-maps/item-contract'
import { resolveMapImage } from '@wizard-archive/editor/game-maps/image-resolution'
import type { CampaignQueryCtx } from '../../functions'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import type { Id } from '../../_generated/dataModel'

export async function getGameMapForDownload(
  ctx: CampaignQueryCtx,
  item: MapItem,
  path: string,
): Promise<DownloadItem> {
  const imageStorageId = resolveMapImage(item).imageAssetId as unknown as Id<'_storage'> | null
  return {
    type: RESOURCE_TYPES.gameMaps,
    name: item.name,
    path,
    downloadUrl: imageStorageId ? await ctx.storage.getUrl(imageStorageId) : null,
  }
}

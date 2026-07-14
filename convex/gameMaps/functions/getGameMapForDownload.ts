import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { MapItem } from '@wizard-archive/editor/game-maps/item-contract'
import { resolveMapImage } from '@wizard-archive/editor/game-maps/image-resolution'
import type { CampaignQueryCtx } from '../../functions'
import type { DownloadItem } from '../../sidebarItems/functions/downloadTypes'
import { getStorageIdByAssetId } from '../../storage/functions/assetIdentity'

export async function getGameMapForDownload(
  ctx: CampaignQueryCtx,
  item: MapItem,
  path: string,
): Promise<DownloadItem> {
  const imageStorageId = await getStorageIdByAssetId(ctx.db, resolveMapImage(item).imageAssetId)
  return {
    type: RESOURCE_TYPES.gameMaps,
    name: item.name,
    path,
    downloadUrl: imageStorageId ? await ctx.storage.getUrl(imageStorageId) : null,
  }
}

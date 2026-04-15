import { enhanceFile, enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceFolder, enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap, enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote, enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceCanvas, enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { assertNever } from '../../common/types'
import type {
  AnySidebarItemFromDb,
  EnhancedByType,
  EnhancedSidebarItem,
  SidebarItemTypeKey,
  WithContentByType,
} from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
) {
  const { membership } = ctx

  const [shares, bookmark, myPermissionLevel, previewUrl] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', item.campaignId).eq('sidebarItemId', item._id),
      )
      .collect(),
    ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', item.campaignId)
          .eq('campaignMemberId', membership._id)
          .eq('sidebarItemId', item._id),
      )
      .unique(),
    getSidebarItemPermissionLevel(ctx, { item }),
    item.previewStorageId ? ctx.storage.getUrl(item.previewStorageId) : null,
  ])

  return {
    ...item,
    shares,
    isBookmarked: bookmark !== null,
    myPermissionLevel,
    previewUrl,
  }
}

export async function enhanceSidebarItem<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<EnhancedSidebarItem<T>> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, { file: item }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, { gameMap: item }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, { folder: item }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, { note: item }) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvas(ctx, { canvas: item }) as Promise<EnhancedSidebarItem<T>>
    default:
      return assertNever(item)
  }
}

export async function enhanceSidebarItemWithContent<
  K extends SidebarItemTypeKey = SidebarItemTypeKey,
>(
  ctx: CampaignQueryCtx,
  { item }: { item: EnhancedByType[SidebarItemTypeKey] },
): Promise<WithContentByType[K]> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNoteWithContent(ctx, { note: item }) as Promise<WithContentByType[K]>
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolderWithContent(ctx, { folder: item }) as Promise<WithContentByType[K]>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMapWithContent(ctx, { gameMap: item }) as Promise<WithContentByType[K]>
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFileWithContent(ctx, { file: item }) as Promise<WithContentByType[K]>
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvasWithContent(ctx, { canvas: item }) as Promise<WithContentByType[K]>
    default:
      return assertNever(item)
  }
}

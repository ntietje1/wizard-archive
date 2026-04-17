import { enhanceFile, enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceFolder, enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap, enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote, enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceCanvas, enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { assertSidebarItemColor } from '../validation/color'
import { assertSidebarItemIconName } from '../validation/icon'
import { assertSidebarItemName } from '../validation/name'
import { assertSidebarItemSlug } from '../validation/slug'
import { assertNever } from '../../common/types'
import type {
  AnySidebarItemFromDb,
  AnySidebarItem,
  EnhancedSidebarItem,
  WithContentSidebarItem,
} from '../types/types'
import type {
  EnhanceSidebarItem as EnhancedBaseSidebarItem,
  NormalizeSidebarItem,
} from '../types/baseTypes'
import type { CampaignQueryCtx } from '../../functions'

function normalizeSidebarItemFields<T extends AnySidebarItemFromDb>(
  item: T,
): NormalizeSidebarItem<T> {
  return {
    ...item,
    name: assertSidebarItemName(item.name),
    iconName: item.iconName === null ? null : assertSidebarItemIconName(item.iconName),
    color: item.color === null ? null : assertSidebarItemColor(item.color),
    slug: assertSidebarItemSlug(item.slug),
  }
}

export async function enhanceBase<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<EnhancedBaseSidebarItem<T>> {
  const { membership } = ctx
  const normalizedItem = normalizeSidebarItemFields(item)

  const [shares, bookmark, myPermissionLevel, previewUrl] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', normalizedItem.campaignId).eq('sidebarItemId', normalizedItem._id),
      )
      .collect(),
    ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', normalizedItem.campaignId)
          .eq('campaignMemberId', membership._id)
          .eq('sidebarItemId', normalizedItem._id),
      )
      .unique(),
    getSidebarItemPermissionLevel(ctx, { item: normalizedItem }),
    normalizedItem.previewStorageId ? ctx.storage.getUrl(normalizedItem.previewStorageId) : null,
  ])

  return {
    ...normalizedItem,
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

export async function enhanceSidebarItemWithContent<T extends AnySidebarItem>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<WithContentSidebarItem<T>> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNoteWithContent(ctx, { note: item }) as Promise<WithContentSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolderWithContent(ctx, { folder: item }) as Promise<WithContentSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMapWithContent(ctx, { gameMap: item }) as Promise<WithContentSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFileWithContent(ctx, { file: item }) as Promise<WithContentSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvasWithContent(ctx, { canvas: item }) as Promise<WithContentSidebarItem<T>>
    default:
      return assertNever(item)
  }
}

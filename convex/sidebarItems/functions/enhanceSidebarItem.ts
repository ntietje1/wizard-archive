import { enhanceFile, enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceFolder, enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap, enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote, enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceCanvas, enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { assertNever } from '../../common/types'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  EnhancedSidebarItem,
  WithContentSidebarItem,
} from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

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

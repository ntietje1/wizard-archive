import { enhanceFile, enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceFolder, enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMap, enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceNote, enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceCanvas, enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  AnyResource,
  AnyResourceRow,
  EnhancedResource,
  WithContentResource,
} from '@wizard-archive/editor/resources/resource-contract'
import { assertNever } from '../../common/types'
import type { CampaignQueryCtx } from '../../functions'
import type { SidebarItemEnhancement } from './enhanceBaseSidebarItem'

export async function enhanceSidebarItem<T extends AnyResourceRow>(
  ctx: CampaignQueryCtx,
  { item, enhancement }: { item: T; enhancement?: SidebarItemEnhancement },
): Promise<EnhancedResource<T>> {
  switch (item.type) {
    case RESOURCE_TYPES.files:
      return enhanceFile(ctx, { file: item, enhancement }) as Promise<EnhancedResource<T>>
    case RESOURCE_TYPES.gameMaps:
      return enhanceGameMap(ctx, { gameMap: item, enhancement }) as Promise<EnhancedResource<T>>
    case RESOURCE_TYPES.folders:
      return enhanceFolder(ctx, { folder: item, enhancement }) as Promise<EnhancedResource<T>>
    case RESOURCE_TYPES.notes:
      return enhanceNote(ctx, { note: item, enhancement }) as Promise<EnhancedResource<T>>
    case RESOURCE_TYPES.canvases:
      return enhanceCanvas(ctx, { canvas: item, enhancement }) as Promise<EnhancedResource<T>>
    default:
      return assertNever(item)
  }
}

export async function enhanceSidebarItemWithContent<T extends AnyResource>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<WithContentResource<T>> {
  switch (item.type) {
    case RESOURCE_TYPES.notes:
      return enhanceNoteWithContent(ctx, { note: item }) as Promise<WithContentResource<T>>
    case RESOURCE_TYPES.folders:
      return enhanceFolderWithContent(ctx, { folder: item }) as Promise<WithContentResource<T>>
    case RESOURCE_TYPES.gameMaps:
      return enhanceGameMapWithContent(ctx, { gameMap: item }) as Promise<WithContentResource<T>>
    case RESOURCE_TYPES.files:
      return enhanceFileWithContent(ctx, { file: item }) as Promise<WithContentResource<T>>
    case RESOURCE_TYPES.canvases:
      return enhanceCanvasWithContent(ctx, { canvas: item }) as Promise<WithContentResource<T>>
    default:
      return assertNever(item)
  }
}

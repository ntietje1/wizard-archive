import { enhanceFile } from '../files/helpers'
import { enhanceFolder } from '../folders/helpers'
import { enhanceGameMap } from '../gameMaps/helpers'
import { enhanceNote } from '../notes/helpers'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type { AnySidebarItemFromDb, EnhancedSidebarItem } from './types'
import type { QueryCtx } from '../_generated/server'

export async function enhanceSidebarItem<T extends AnySidebarItemFromDb>(
  ctx: QueryCtx,
  item: T,
): Promise<EnhancedSidebarItem<T>> {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, item) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, item) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, item) as Promise<EnhancedSidebarItem<T>>
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, item) as Promise<EnhancedSidebarItem<T>>
  }
}

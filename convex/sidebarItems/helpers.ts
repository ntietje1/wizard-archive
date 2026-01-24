import { enhanceFile } from '../files/helpers'
import { enhanceFolder } from '../folders/helpers'
import { enhanceGameMap } from '../gameMaps/helpers'
import { enhanceNote } from '../notes/helpers'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type { AnySidebarItem, AnySidebarItemFromDb } from './types'
import type { QueryCtx } from '../_generated/server'

export const enhanceSidebarItem = async (
  ctx: QueryCtx,
  item: AnySidebarItemFromDb,
): Promise<AnySidebarItem> => {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFile(ctx, item)
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMap(ctx, item)
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolder(ctx, item)
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNote(ctx, item)
  }
}

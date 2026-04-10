import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { assertNever } from '../../common/types'
import type { QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemTypeKey, FromDbByType } from '../types/types'

export async function getSidebarItem<K extends SidebarItemTypeKey = SidebarItemTypeKey>(
  ctx: Pick<QueryCtx, 'db'>,
  id: Id<'sidebarItems'>,
): Promise<FromDbByType[K] | null> {
  const raw = await ctx.db.get('sidebarItems', id)
  if (!raw) return null
  switch (raw.type) {
    case SIDEBAR_ITEM_TYPES.folders: {
      const ext = await ctx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', raw._id))
        .unique()
      if (!ext) throw new Error(`Missing folder extension row for sidebarItem ${raw._id}`)
      return { ...raw, inheritShares: ext.inheritShares } as FromDbByType[K]
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const ext = await ctx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', raw._id))
        .unique()
      if (!ext) throw new Error(`Missing gameMap extension row for sidebarItem ${raw._id}`)
      return { ...raw, imageStorageId: ext.imageStorageId } as FromDbByType[K]
    }
    case SIDEBAR_ITEM_TYPES.files: {
      const ext = await ctx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', raw._id))
        .unique()
      if (!ext) throw new Error(`Missing file extension row for sidebarItem ${raw._id}`)
      return { ...raw, storageId: ext.storageId } as FromDbByType[K]
    }
    case SIDEBAR_ITEM_TYPES.notes:
      return raw as FromDbByType[K]
    case SIDEBAR_ITEM_TYPES.canvases:
      return raw as FromDbByType[K]
    default:
      return assertNever(raw.type)
  }
}

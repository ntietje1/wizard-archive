import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'

export const folderTriggers: SidebarItemTriggerHandlers = {
  onSoftDelete: async () => {},

  onRestore: async () => {},

  onHardDelete: async (db, _storage, item) => {
    const ext = await db
      .query('folders')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (ext) await db.delete('folders', ext._id)
    return null
  },
}

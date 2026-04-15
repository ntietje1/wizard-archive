import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'

export const fileTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, storage, item) => {
    const ext = await db
      .query('files')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (ext?.storageId) await storage.delete(ext.storageId)
    if (ext) await db.delete('files', ext._id)
    return null
  },
}

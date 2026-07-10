import { isStorageReferencedByCampaignContent } from '../storage/functions/storageReferences'
import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'

export const fileTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, storage, item) => {
    const ext = await db
      .query('files')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (!ext) return new Set()

    await db.delete('files', ext._id)

    if (ext.storageId && !(await isStorageReferencedByCampaignContent(db, ext.storageId))) {
      await storage.delete(ext.storageId)
      return new Set([ext.storageId])
    }
    return new Set()
  },
}

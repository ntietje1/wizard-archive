import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'
import type { Id } from '../_generated/dataModel'
import type { DatabaseWriter } from '../_generated/server'

async function isStorageUsedByAnotherFile(
  db: DatabaseWriter,
  storageId: Id<'_storage'>,
  sidebarItemId: Id<'sidebarItems'>,
) {
  const files = await db
    .query('files')
    .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
    .filter((q) => q.neq(q.field('sidebarItemId'), sidebarItemId))
    .first()
  return files !== null
}

export const fileTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, storage, item) => {
    const ext = await db
      .query('files')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (!ext) return new Set()

    await db.delete('files', ext._id)

    if (ext.storageId && !(await isStorageUsedByAnotherFile(db, ext.storageId, item.id))) {
      await storage.delete(ext.storageId)
      return new Set([ext.storageId])
    }
    return new Set()
  },
}

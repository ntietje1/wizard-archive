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
    .collect()
  return files.some((file) => file.sidebarItemId !== sidebarItemId)
}

export const fileTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, storage, item) => {
    const ext = await db
      .query('files')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (ext?.storageId && !(await isStorageUsedByAnotherFile(db, ext.storageId, item.id))) {
      await storage.delete(ext.storageId)
    }
    if (ext) await db.delete('files', ext._id)
    return ext?.storageId ?? null
  },
}

import { deleteYjsDocument } from '../yjsSync/functions/deleteYjsDocument'
import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'

export const canvasTriggers: SidebarItemTriggerHandlers = {
  onSoftDelete: async () => {},

  onRestore: async () => {},

  onHardDelete: async (db, _storage, item) => {
    const ext = await db
      .query('canvases')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
      .unique()
    if (ext) await db.delete('canvases', ext._id)
    await deleteYjsDocument({ db }, item.id)
    return null
  },
}

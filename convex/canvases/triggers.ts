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
    await Promise.all([
      ext ? db.delete('canvases', ext._id) : Promise.resolve(),
      deleteYjsDocument({ db }, item.id),
    ])
    return null
  },
}

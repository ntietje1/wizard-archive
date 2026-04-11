import { asyncMap } from 'convex-helpers'
import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'
import type { Id } from '../_generated/dataModel'
import type { DatabaseWriter } from '../_generated/server'

async function getPins(db: DatabaseWriter, mapId: Id<'sidebarItems'>) {
  return await db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()
}

export const gameMapTriggers: SidebarItemTriggerHandlers = {
  onSoftDelete: async (db, item, deletion) => {
    const pins = await getPins(db, item.id)
    await asyncMap(pins, (p) => db.patch('mapPins', p._id, deletion))
  },

  onRestore: async (db, item, cleared) => {
    const pins = await getPins(db, item.id)
    await asyncMap(pins, (p) => db.patch('mapPins', p._id, cleared))
  },

  onHardDelete: async (db, storage, item) => {
    const [pins, ext] = await Promise.all([
      getPins(db, item.id),
      db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
        .unique(),
    ])
    const imageStorageId = ext?.imageStorageId ?? null
    if (imageStorageId) await storage.delete(imageStorageId)
    await asyncMap(pins, (p) => db.delete('mapPins', p._id))
    if (ext) await db.delete('gameMaps', ext._id)
    return imageStorageId
  },
}

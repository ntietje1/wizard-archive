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

async function isStorageUsedByAnotherMap(
  db: DatabaseWriter,
  storageId: Id<'_storage'>,
  sidebarItemId: Id<'sidebarItems'>,
) {
  const maps = await db
    .query('gameMaps')
    .withIndex('by_imageStorageId', (q) => q.eq('imageStorageId', storageId))
    .filter((q) => q.neq(q.field('sidebarItemId'), sidebarItemId))
    .first()
  return maps !== null
}

export const gameMapTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, storage, item) => {
    const [pins, ext] = await Promise.all([
      getPins(db, item.id),
      db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
        .unique(),
    ])
    const imageStorageId = ext?.imageStorageId ?? null
    await asyncMap(pins, (p) => db.delete('mapPins', p._id))
    if (ext) await db.delete('gameMaps', ext._id)
    if (imageStorageId && !(await isStorageUsedByAnotherMap(db, imageStorageId, item.id))) {
      await storage.delete(imageStorageId)
      return new Set([imageStorageId])
    }
    return new Set()
  },
}

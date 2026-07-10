import { asyncMap } from 'convex-helpers'
import { isStorageReferencedByCampaignContent } from '../storage/functions/storageReferences'
import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'
import type { Id } from '../_generated/dataModel'
import type { DatabaseReader } from '../_generated/server'

async function getPins(db: Pick<DatabaseReader, 'query'>, mapId: Id<'sidebarItems'>) {
  return await db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()
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
    if (imageStorageId && !(await isStorageReferencedByCampaignContent(db, imageStorageId))) {
      await storage.delete(imageStorageId)
      return new Set([imageStorageId])
    }
    return new Set()
  },
}

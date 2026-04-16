import { asyncMap } from 'convex-helpers'
import { deleteYjsDocument } from '../yjsSync/functions/deleteYjsDocument'
import type { SidebarItemTriggerHandlers } from '../sidebarItems/triggerTypes'

export const noteTriggers: SidebarItemTriggerHandlers = {
  onHardDelete: async (db, _storage, item) => {
    const [blocks, blockShares, ext, outgoingLinks, incomingLinks] = await Promise.all([
      db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', item.campaignId).eq('noteId', item.id),
        )
        .collect(),
      db
        .query('blockShares')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', item.campaignId).eq('noteId', item.id),
        )
        .collect(),
      db
        .query('notes')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', item.id))
        .unique(),
      db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', item.campaignId).eq('sourceNoteId', item.id),
        )
        .collect(),
      db
        .query('noteLinks')
        .withIndex('by_campaign_target', (q) =>
          q.eq('campaignId', item.campaignId).eq('targetItemId', item.id),
        )
        .collect(),
    ])
    await asyncMap(blocks, (b) => db.delete('blocks', b._id))
    await asyncMap(blockShares, (bs) => db.delete('blockShares', bs._id))
    if (ext) await db.delete('notes', ext._id)
    await deleteYjsDocument({ db }, item.id)
    await asyncMap([...outgoingLinks, ...incomingLinks], (link) => db.delete('noteLinks', link._id))
    return null
  },
}

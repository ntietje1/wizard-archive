import { deleteYjsDocument } from '../yjsSync/functions/deleteYjsDocument'
import type { SidebarItemTriggerHandlers, CascadeItem } from '../sidebarItems/triggerTypes'
import type { DatabaseWriter } from '../_generated/server'

async function getBlocksAndShares(db: DatabaseWriter, item: CascadeItem) {
  return await Promise.all([
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
  ])
}

export const noteTriggers: SidebarItemTriggerHandlers = {
  onSoftDelete: async (db, item, deletion) => {
    const [blocks, blockShares] = await getBlocksAndShares(db, item)
    await Promise.all([
      ...blocks.map((b) => db.patch('blocks', b._id, deletion)),
      ...blockShares.map((bs) => db.patch('blockShares', bs._id, deletion)),
    ])
  },

  onRestore: async (db, item, cleared) => {
    const [blocks, blockShares] = await getBlocksAndShares(db, item)
    await Promise.all([
      ...blocks.map((b) => db.patch('blocks', b._id, cleared)),
      ...blockShares.map((bs) => db.patch('blockShares', bs._id, cleared)),
    ])
  },

  onHardDelete: async (db, _storage, item) => {
    const [blocks, blockShares, ext] = await Promise.all([
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
    ])
    await Promise.all([
      ...blocks.map((b) => db.delete('blocks', b._id)),
      ...blockShares.map((bs) => db.delete('blockShares', bs._id)),
      ext ? db.delete('notes', ext._id) : Promise.resolve(),
      deleteYjsDocument({ db }, item.id),
    ])
    return null
  },
}

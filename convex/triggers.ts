import { Triggers } from 'convex-helpers/server/triggers'
import { SIDEBAR_ITEM_TYPES } from './sidebarItems/types/baseTypes'
import type { MutationCtx } from './_generated/server'
import type { DataModel, Id } from './_generated/dataModel'

export const triggers = new Triggers<DataModel, MutationCtx>()

type Db = MutationCtx['db']
type Storage = MutationCtx['storage']

const EXTENSION_TABLE = {
  [SIDEBAR_ITEM_TYPES.notes]: 'notes',
  [SIDEBAR_ITEM_TYPES.folders]: 'folders',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'gameMaps',
  [SIDEBAR_ITEM_TYPES.files]: 'files',
  [SIDEBAR_ITEM_TYPES.canvases]: 'canvases',
} as const

type ExtensionTable = (typeof EXTENSION_TABLE)[keyof typeof EXTENSION_TABLE]

async function getExtensionRow(db: Db, sidebarItemId: Id<'sidebarItems'>, table: ExtensionTable) {
  return await db
    .query(table)
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sidebarItemId))
    .unique()
}

async function getFileExtension(db: Db, sidebarItemId: Id<'sidebarItems'>) {
  return await db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sidebarItemId))
    .unique()
}

async function getGameMapExtension(db: Db, sidebarItemId: Id<'sidebarItems'>) {
  return await db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sidebarItemId))
    .unique()
}

triggers.register('sidebarItems', async (ctx, change) => {
  const db = ctx.innerDb

  if (change.operation === 'update') {
    const { oldDoc, newDoc } = change
    const wasTrashed = oldDoc.deletionTime === null && newDoc.deletionTime !== null
    const wasRestored = oldDoc.deletionTime !== null && newDoc.deletionTime === null

    if (wasTrashed) {
      await cascadeSoftDelete(db, {
        id: newDoc._id,
        type: newDoc.type,
        campaignId: newDoc.campaignId,
        deletionTime: newDoc.deletionTime!,
        deletedBy: newDoc.deletedBy,
      })
    } else if (wasRestored) {
      await cascadeRestore(db, {
        id: newDoc._id,
        type: newDoc.type,
        campaignId: newDoc.campaignId,
      })
    }
  }

  if (change.operation === 'delete') {
    const { oldDoc } = change
    await cascadeHardDelete(db, ctx.storage, {
      id: oldDoc._id,
      type: oldDoc.type,
      campaignId: oldDoc.campaignId,
      previewStorageId: oldDoc.previewStorageId,
    })
  }
})

// --- Soft-delete cascade ---

async function cascadeSoftDelete(
  db: Db,
  item: {
    id: Id<'sidebarItems'>
    type: string
    campaignId: Id<'campaigns'>
    deletionTime: number
    deletedBy: Id<'userProfiles'> | null
  },
) {
  const deletion = { deletionTime: item.deletionTime, deletedBy: item.deletedBy }
  const extTable = EXTENSION_TABLE[item.type as keyof typeof EXTENSION_TABLE]

  const ext = await getExtensionRow(db, item.id, extTable)
  if (ext) await db.patch(extTable, ext._id, deletion)

  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) =>
    db.patch(table, id, deletion),
  )

  await cascadeTypeDependentsSoftDelete(db, item, deletion)
}

async function cascadeTypeDependentsSoftDelete(
  db: Db,
  item: { id: Id<'sidebarItems'>; type: string; campaignId: Id<'campaigns'> },
  deletion: { deletionTime: number; deletedBy: Id<'userProfiles'> | null },
) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes: {
      const [blocks, blockShares] = await Promise.all([
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
      await Promise.all([
        ...blocks.map((b) => db.patch('blocks', b._id, deletion)),
        ...blockShares.map((bs) => db.patch('blockShares', bs._id, deletion)),
      ])
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const pins = await db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', item.id))
        .collect()
      await Promise.all(pins.map((p) => db.patch('mapPins', p._id, deletion)))
      break
    }
    case SIDEBAR_ITEM_TYPES.canvases: {
      // Yjs rows are ephemeral sync state — hard-delete on trash, no restore needed
      await deleteYjsRows(db, item.id)
      break
    }
  }
}

// --- Restore cascade ---

async function cascadeRestore(
  db: Db,
  item: { id: Id<'sidebarItems'>; type: string; campaignId: Id<'campaigns'> },
) {
  const cleared = { deletionTime: null, deletedBy: null }
  const extTable = EXTENSION_TABLE[item.type as keyof typeof EXTENSION_TABLE]

  const ext = await getExtensionRow(db, item.id, extTable)
  if (ext) await db.patch(extTable, ext._id, cleared)

  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) =>
    db.patch(table, id, cleared),
  )

  await cascadeTypeDependentsRestore(db, item, cleared)
}

async function cascadeTypeDependentsRestore(
  db: Db,
  item: { id: Id<'sidebarItems'>; type: string; campaignId: Id<'campaigns'> },
  cleared: { deletionTime: null; deletedBy: null },
) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes: {
      const [blocks, blockShares] = await Promise.all([
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
      await Promise.all([
        ...blocks.map((b) => db.patch('blocks', b._id, cleared)),
        ...blockShares.map((bs) => db.patch('blockShares', bs._id, cleared)),
      ])
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const pins = await db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', item.id))
        .collect()
      await Promise.all(pins.map((p) => db.patch('mapPins', p._id, cleared)))
      break
    }
  }
}

// --- Hard-delete cascade ---

async function cascadeHardDelete(
  db: Db,
  storage: Storage,
  item: {
    id: Id<'sidebarItems'>
    type: string
    campaignId: Id<'campaigns'>
    previewStorageId: Id<'_storage'> | null
  },
) {
  const extTable = EXTENSION_TABLE[item.type as keyof typeof EXTENSION_TABLE]

  // Clean up file storage
  if (item.type === SIDEBAR_ITEM_TYPES.files) {
    const fileExt = await getFileExtension(db, item.id)
    if (fileExt?.storageId) await storage.delete(fileExt.storageId)
    if (fileExt) await db.delete('files', fileExt._id)
  }

  // Clean up map image storage
  let mapImageId: Id<'_storage'> | null = null
  if (item.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    const mapExt = await getGameMapExtension(db, item.id)
    mapImageId = mapExt?.imageStorageId ?? null
    if (mapImageId) await storage.delete(mapImageId)
    if (mapExt) await db.delete('gameMaps', mapExt._id)
  }

  // Clean up preview image (skip maps where preview === image)
  if (
    item.previewStorageId &&
    !(item.type === SIDEBAR_ITEM_TYPES.gameMaps && item.previewStorageId === mapImageId)
  ) {
    await storage.delete(item.previewStorageId)
  }

  // Delete extension row for other types
  if (item.type !== SIDEBAR_ITEM_TYPES.files && item.type !== SIDEBAR_ITEM_TYPES.gameMaps) {
    const ext = await getExtensionRow(db, item.id, extTable)
    if (ext) await db.delete(extTable, ext._id)
  }

  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) => db.delete(table, id))

  await cascadeTypeDependentsHardDelete(db, item)
}

async function cascadeTypeDependentsHardDelete(
  db: Db,
  item: { id: Id<'sidebarItems'>; type: string; campaignId: Id<'campaigns'> },
) {
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes: {
      const [blocks, blockShares] = await Promise.all([
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
      await Promise.all([
        ...blocks.map((b) => db.delete('blocks', b._id)),
        ...blockShares.map((bs) => db.delete('blockShares', bs._id)),
      ])
      await deleteYjsRows(db, item.id)
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const pins = await db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', item.id))
        .collect()
      await Promise.all(pins.map((p) => db.delete('mapPins', p._id)))
      break
    }
    case SIDEBAR_ITEM_TYPES.canvases: {
      await deleteYjsRows(db, item.id)
      break
    }
  }
}

// --- Shared helpers ---

async function cascadeSharedDependents(
  db: Db,
  sidebarItemId: Id<'sidebarItems'>,
  campaignId: Id<'campaigns'>,
  operation: (id: any, table: any) => Promise<void>,
) {
  const [shares, bookmarks] = await Promise.all([
    db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
      )
      .collect(),
    db
      .query('bookmarks')
      .withIndex('by_campaign_item', (q) =>
        q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
      )
      .collect(),
  ])

  await Promise.all([
    ...shares.map((s) => operation(s._id, 'sidebarItemShares')),
    ...bookmarks.map((b) => operation(b._id, 'bookmarks')),
  ])
}

async function deleteYjsRows(db: Db, documentId: Id<'sidebarItems'>) {
  const [updates, awareness] = await Promise.all([
    db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .collect(),
    db
      .query('yjsAwareness')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .collect(),
  ])
  await Promise.all([
    ...updates.map((r) => db.delete('yjsUpdates', r._id)),
    ...awareness.map((r) => db.delete('yjsAwareness', r._id)),
  ])
}

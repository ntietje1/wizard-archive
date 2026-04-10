import { SIDEBAR_ITEM_TYPES } from './types/baseTypes'
import { noteTriggers } from '../notes/triggers'
import { gameMapTriggers } from '../gameMaps/triggers'
import { canvasTriggers } from '../canvases/triggers'
import { fileTriggers } from '../files/triggers'
import { folderTriggers } from '../folders/triggers'
import type { SidebarItemTriggerHandlers } from './triggerTypes'
import type { SidebarItemType } from './types/baseTypes'
import type { Triggers } from 'convex-helpers/server/triggers'
import type { DataModel, Id } from '../_generated/dataModel'
import type { DatabaseWriter, MutationCtx } from '../_generated/server'

const handlers: Record<SidebarItemType, SidebarItemTriggerHandlers> = {
  [SIDEBAR_ITEM_TYPES.notes]: noteTriggers,
  [SIDEBAR_ITEM_TYPES.gameMaps]: gameMapTriggers,
  [SIDEBAR_ITEM_TYPES.canvases]: canvasTriggers,
  [SIDEBAR_ITEM_TYPES.files]: fileTriggers,
  [SIDEBAR_ITEM_TYPES.folders]: folderTriggers,
}

async function cascadeSoftDelete(
  db: DatabaseWriter,
  item: {
    id: Id<'sidebarItems'>
    type: SidebarItemType
    campaignId: Id<'campaigns'>
    deletionTime: number
    deletedBy: Id<'userProfiles'> | null
  },
) {
  const deletion = { deletionTime: item.deletionTime, deletedBy: item.deletedBy }

  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) =>
    db.patch(table, id, deletion),
  )

  await handlers[item.type].onSoftDelete(db, item, deletion)
}

async function cascadeRestore(
  db: DatabaseWriter,
  item: { id: Id<'sidebarItems'>; type: SidebarItemType; campaignId: Id<'campaigns'> },
) {
  const cleared = { deletionTime: null as null, deletedBy: null as null }

  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) =>
    db.patch(table, id, cleared),
  )

  await handlers[item.type].onRestore(db, item, cleared)
}

async function cascadeHardDelete(
  db: DatabaseWriter,
  storage: MutationCtx['storage'],
  item: {
    id: Id<'sidebarItems'>
    type: SidebarItemType
    campaignId: Id<'campaigns'>
    previewStorageId: Id<'_storage'> | null
  },
) {
  await cascadeSharedDependents(db, item.id, item.campaignId, (id, table) => db.delete(table, id))

  const deletedStorageId = await handlers[item.type].onHardDelete(db, storage, item)

  if (item.previewStorageId && item.previewStorageId !== deletedStorageId) {
    await storage.delete(item.previewStorageId)
  }
}

async function cascadeSharedDependents(
  db: DatabaseWriter,
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

export function registerSidebarItemTriggers(triggers: Triggers<DataModel, MutationCtx>) {
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
}

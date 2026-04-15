import { asyncMap } from 'convex-helpers'
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
  await cascadeSharedDependents(db, item.id, item.campaignId)

  const deletedStorageId = await handlers[item.type].onHardDelete(db, storage, item)

  if (item.previewStorageId && item.previewStorageId !== deletedStorageId) {
    await storage.delete(item.previewStorageId)
  }
}

async function cascadeSharedDependents(
  db: DatabaseWriter,
  sidebarItemId: Id<'sidebarItems'>,
  campaignId: Id<'campaigns'>,
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

  await asyncMap(shares, (s) => db.delete('sidebarItemShares', s._id))
  await asyncMap(bookmarks, (b) => db.delete('bookmarks', b._id))
}

export function registerSidebarItemTriggers(triggers: Triggers<DataModel, MutationCtx>) {
  triggers.register('sidebarItems', async (ctx, change) => {
    if (change.operation === 'delete') {
      const { oldDoc } = change
      await cascadeHardDelete(ctx.innerDb, ctx.storage, {
        id: oldDoc._id,
        type: oldDoc.type,
        campaignId: oldDoc.campaignId,
        previewStorageId: oldDoc.previewStorageId,
      })
    }
  })
}

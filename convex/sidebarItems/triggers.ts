import { asyncMap } from 'convex-helpers'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { noteTriggers } from '../notes/triggers'
import { gameMapTriggers } from '../gameMaps/triggers'
import { canvasTriggers } from '../canvases/triggers'
import { fileTriggers } from '../files/triggers'
import { folderTriggers } from '../folders/triggers'
import { internal } from '../_generated/api'
import { isStorageReferencedByCampaignContent } from '../storage/functions/storageReferences'
import { getPreviewLease } from './previewLease'
import type { SidebarItemTriggerHandlers } from './triggerTypes'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-contract'
import type { Triggers } from 'convex-helpers/server/triggers'
import type { DataModel, Id } from '../_generated/dataModel'
import type { DatabaseWriter, MutationCtx } from '../_generated/server'

const handlers: Record<ResourceKind, SidebarItemTriggerHandlers> = {
  [RESOURCE_TYPES.notes]: noteTriggers,
  [RESOURCE_TYPES.gameMaps]: gameMapTriggers,
  [RESOURCE_TYPES.canvases]: canvasTriggers,
  [RESOURCE_TYPES.files]: fileTriggers,
  [RESOURCE_TYPES.folders]: folderTriggers,
}

async function cascadeHardDelete(
  db: DatabaseWriter,
  storage: MutationCtx['storage'],
  item: {
    id: Id<'sidebarItems'>
    type: ResourceKind
    campaignId: Id<'campaigns'>
    previewStorageId: Id<'_storage'> | null
  },
) {
  await cascadeSharedDependents(db, item.id, item.campaignId)

  const deletedStorageIds = await handlers[item.type].onHardDelete(db, storage, item)

  if (
    item.previewStorageId &&
    !deletedStorageIds.has(item.previewStorageId) &&
    !(await isStorageReferencedByCampaignContent(db, item.previewStorageId))
  ) {
    await storage.delete(item.previewStorageId)
  }
}

async function cascadeSharedDependents(
  db: DatabaseWriter,
  sidebarItemId: Id<'sidebarItems'>,
  campaignId: Id<'campaigns'>,
) {
  const [shares, bookmarks, previewLease] = await Promise.all([
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
    getPreviewLease({ db }, sidebarItemId),
  ])

  await asyncMap(shares, (s) => db.delete('sidebarItemShares', s._id))
  await asyncMap(bookmarks, (b) => db.delete('bookmarks', b._id))
  if (previewLease) await db.delete('sidebarItemPreviewLeases', previewLease._id)
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
      await ctx.scheduler.runAfter(
        0,
        internal.documentSnapshots.internalMutations.cleanupItemHistoryBatch,
        { itemId: oldDoc._id },
      )
    }
  })
}

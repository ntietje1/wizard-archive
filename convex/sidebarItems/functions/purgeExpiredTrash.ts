import { internal } from '../../_generated/api'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
  TRASH_RETENTION_DAYS,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { hardDeleteTree } from '../filesystem/treeWrites'
import type { MutationCtx } from '../../_generated/server'
import type { Doc, Id } from '../../_generated/dataModel'
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

const BATCH_SIZE = 50
type StoredSidebarItemRow = Doc<'sidebarItems'>

async function getExpiredTrashItems(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  cutoff: number,
  limit: number,
) {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_deletionTime', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('status', RESOURCE_STATUS.trashed)
        .lt('deletionTime', cutoff),
    )
    .take(limit)
}

async function hasExpiredTrashParent(ctx: MutationCtx, item: StoredSidebarItemRow, cutoff: number) {
  if (!item.parentId) return false
  const parent = await ctx.db.get('sidebarItems', item.parentId)
  return Boolean(parent?.deletionTime && parent.deletionTime < cutoff)
}

async function hardDeleteCurrentTree(ctx: MutationCtx, itemId: Id<'sidebarItems'>) {
  const current = await ctx.db.get('sidebarItems', itemId)
  return current ? await hardDeleteTree(ctx, current) : 0
}

async function purgeExpiredFolderRoots(
  ctx: MutationCtx,
  items: Array<StoredSidebarItemRow>,
  cutoff: number,
  remaining: () => number,
) {
  let deleted = 0
  for (const folder of items) {
    if (remaining() <= 0) break
    const currentFolder = await ctx.db.get('sidebarItems', folder._id)
    if (!currentFolder || (await hasExpiredTrashParent(ctx, currentFolder, cutoff))) continue
    deleted += await hardDeleteTree(ctx, currentFolder)
  }
  return deleted
}

async function purgeExpiredLeaves(
  ctx: MutationCtx,
  items: Array<StoredSidebarItemRow>,
  remaining: () => number,
) {
  let deleted = 0
  for (const leaf of items) {
    if (remaining() <= 0) break
    deleted += await hardDeleteCurrentTree(ctx, leaf._id)
  }
  return deleted
}

export async function purgeExpiredTrash(ctx: MutationCtx): Promise<void> {
  const cutoff = Date.now() - TRASH_RETENTION_MS

  let deleted = 0
  let paginationCursor: string | null = null
  let hasMore = true

  while (hasMore && deleted < BATCH_SIZE) {
    const page = await ctx.db
      .query('campaigns')
      .paginate({ numItems: 10, cursor: paginationCursor })
    hasMore = !page.isDone
    paginationCursor = page.continueCursor

    for (const campaign of page.page) {
      if (deleted >= BATCH_SIZE) break

      const expired = await getExpiredTrashItems(ctx, campaign._id, cutoff, BATCH_SIZE - deleted)
      const expiredFolders = expired.filter((i) => i.type === RESOURCE_TYPES.folders)
      const expiredLeaves = expired.filter((i) => i.type !== RESOURCE_TYPES.folders)
      const remaining = () => BATCH_SIZE - deleted
      deleted += await purgeExpiredFolderRoots(ctx, expiredFolders, cutoff, remaining)
      deleted += await purgeExpiredLeaves(ctx, expiredLeaves, remaining)
    }
  }

  if (deleted >= BATCH_SIZE) {
    await ctx.scheduler.runAfter(1000, internal.sidebarItems.internalMutations.purgeExpiredTrash)
  }
}

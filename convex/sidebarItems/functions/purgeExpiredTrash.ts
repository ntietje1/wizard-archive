import { internal } from '../../_generated/api'
import { TRASH_RETENTION_DAYS } from '../../common/constants'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { hardDeleteItem } from './hardDeleteItem'
import { hardDeleteTree } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import type { MutationCtx } from '../../_generated/server'

const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

const BATCH_SIZE = 50

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

      const expired = await ctx.db
        .query('sidebarItems')
        .withIndex('by_campaign_deletionTime', (q) =>
          q.eq('campaignId', campaign._id).gt('deletionTime', 0).lt('deletionTime', cutoff),
        )
        .collect()

      const expiredFolders = expired.filter((i) => i.type === SIDEBAR_ITEM_TYPES.folders)
      const expiredLeaves = expired.filter((i) => i.type !== SIDEBAR_ITEM_TYPES.folders)

      for (const folder of expiredFolders) {
        if (deleted >= BATCH_SIZE) break
        const currentFolder = await ctx.db.get('sidebarItems', folder._id)
        if (!currentFolder) continue
        if (currentFolder.parentId) {
          const parent = await ctx.db.get('sidebarItems', currentFolder.parentId)
          if (parent?.deletionTime && parent.deletionTime < cutoff) continue
        }
        const enhanced = await getSidebarItem(ctx, currentFolder._id)
        if (!enhanced) continue
        const count = await hardDeleteTree(ctx, enhanced)
        deleted += count
      }

      for (const leaf of expiredLeaves) {
        if (deleted >= BATCH_SIZE) break
        const current = await ctx.db.get('sidebarItems', leaf._id)
        if (!current) continue
        const enhanced = await getSidebarItem(ctx, current._id)
        if (!enhanced) continue
        await hardDeleteItem(ctx, enhanced)
        deleted++
      }
    }
  }

  if (deleted >= BATCH_SIZE) {
    await ctx.scheduler.runAfter(1000, internal.sidebarItems.internalMutations.purgeExpiredTrash)
  }
}

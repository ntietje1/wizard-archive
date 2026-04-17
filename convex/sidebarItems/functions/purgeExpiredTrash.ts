import { internal } from '../../_generated/api'
import { TRASH_RETENTION_DAYS } from '../../common/constants'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { hardDeleteItem } from './hardDeleteItem'
import { hardDeleteTree } from './treeOperations'
import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'

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
        .withIndex('by_campaign', (q) =>
          q.eq('campaignId', campaign._id).gt('deletionTime', 0).lt('deletionTime', cutoff),
        )
        .collect()

      const expiredFolders = expired.filter((i) => i.type === SIDEBAR_ITEM_TYPES.folders)
      const expiredLeaves = expired.filter((i) => i.type !== SIDEBAR_ITEM_TYPES.folders)

      for (const folder of expiredFolders) {
        if (deleted >= BATCH_SIZE) break
        const currentFolder: AnySidebarItemRow | null = await ctx.db.get('sidebarItems', folder._id)
        if (!currentFolder) continue
        if (currentFolder.parentId) {
          const parent: AnySidebarItemRow | null = await ctx.db.get(
            'sidebarItems',
            currentFolder.parentId,
          )
          if (parent?.deletionTime && parent.deletionTime < cutoff) continue
        }
        const count = await hardDeleteTree(ctx, currentFolder)
        deleted += count
      }

      for (const leaf of expiredLeaves) {
        if (deleted >= BATCH_SIZE) break
        const current: AnySidebarItemRow | null = await ctx.db.get('sidebarItems', leaf._id)
        if (!current) continue
        await hardDeleteItem(ctx, current)
        deleted++
      }
    }
  }

  if (deleted >= BATCH_SIZE) {
    await ctx.scheduler.runAfter(1000, internal.sidebarItems.internalMutations.purgeExpiredTrash)
  }
}

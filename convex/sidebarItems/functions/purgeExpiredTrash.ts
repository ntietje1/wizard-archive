import { internal } from '../../_generated/api'
import { TRASH_RETENTION_DAYS } from '../../common/constants'
import { hardDeleteItem } from './hardDeleteItem'
import { applyToTree } from './applyToTree'
import type { MutationCtx } from '../../_generated/server'

const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

const TRASHED_TABLES = ['folders', 'notes', 'gameMaps', 'files'] as const

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

      const campaignId = campaign._id

      const results = await Promise.all(
        TRASHED_TABLES.map((table) =>
          ctx.db
            .query(table)
            .withIndex('by_campaign_deletionTime', (q) =>
              q.eq('campaignId', campaignId).gt('deletionTime', 0).lt('deletionTime', cutoff),
            )
            .collect(),
        ),
      )

      const [expiredFolders, ...expiredLeafItems] = results

      for (const folder of expiredFolders) {
        if (deleted >= BATCH_SIZE) break
        // eslint-disable-next-line @convex-dev/explicit-table-ids
        const currentFolder = await ctx.db.get(folder._id)
        if (!currentFolder) continue
        if (currentFolder.parentId) {
          const parent = await ctx.db.get("folders", currentFolder.parentId)
          if (parent?.deletionTime && parent.deletionTime < cutoff) continue
        }
        const count = await applyToTree(ctx, currentFolder, hardDeleteItem)
        deleted += count
      }

      leafLoop: for (const items of expiredLeafItems) {
        for (const item of items) {
          if (deleted >= BATCH_SIZE) break leafLoop
          // eslint-disable-next-line @convex-dev/explicit-table-ids
          const current = await ctx.db.get(item._id)
          if (!current) continue
          await hardDeleteItem(ctx, current)
          deleted++
        }
      }
    }
  }

  if (deleted >= BATCH_SIZE) {
    await ctx.scheduler.runAfter(1000, internal.sidebarItems.internalMutations.purgeExpiredTrash)
  }
}

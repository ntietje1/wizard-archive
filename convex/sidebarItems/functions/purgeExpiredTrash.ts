import { TRASH_RETENTION_DAYS } from '../../common/constants'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { hardDeleteItem } from './hardDeleteItem'
import { applyToTree } from './applyToTree'
import type { MutationCtx } from '../../_generated/server'

const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000

const TRASHED_TABLES = ['folders', 'notes', 'gameMaps', 'files'] as const

export async function purgeExpiredTrash(ctx: MutationCtx): Promise<void> {
  const cutoff = Date.now() - TRASH_RETENTION_MS

  const campaigns = await ctx.db.query('campaigns').collect()

  for (const campaign of campaigns) {
    const campaignId = campaign._id

    // Query expired items from all tables
    const results = await Promise.all(
      TRASHED_TABLES.map((table) =>
        ctx.db
          .query(table)
          .withIndex('by_campaign_deletionTime', (q) =>
            q
              .eq('campaignId', campaignId)
              .gt('deletionTime', 0)
              .lt('deletionTime', cutoff),
          )
          .collect(),
      ),
    )

    const [expiredFolders, ...expiredLeafItems] = results

    // Delete root-level folders first (cascades to children via applyToTree)
    for (const folder of expiredFolders) {
      const currentFolder = await ctx.db.get(folder._id)
      if (!currentFolder) continue
      // Skip if parent is also trashed (will be handled by cascade)
      if (currentFolder.parentId) {
        const parent = await ctx.db.get(currentFolder.parentId)
        if (parent?.deletionTime && parent.deletionTime < cutoff) continue
      }
      await applyToTree(ctx, currentFolder, hardDeleteItem, {
        location: SIDEBAR_ITEM_LOCATION.trash,
      })
    }

    // Delete leaf items (notes, maps, files)
    for (const items of expiredLeafItems) {
      for (const item of items) {
        const current = await ctx.db.get(item._id)
        if (!current) continue
        await hardDeleteItem(ctx, current)
      }
    }
  }
}

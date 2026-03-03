import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { buildCampaignMutationCtx } from '../functions'
import { hardDeleteItem } from './functions/hardDeleteItem'
import { applyToTree } from './functions/applyToTree'
import type { AnySidebarItemFromDb } from './types/types'
import type { Id } from '../_generated/dataModel'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const TRASHED_TABLES = ['folders', 'notes', 'gameMaps', 'files'] as const

export const purgeExpiredTrash = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const cutoff = Date.now() - THIRTY_DAYS_MS

    const campaigns = await ctx.db.query('campaigns').collect()

    const processedCampaigns = new Map<
      string,
      Awaited<ReturnType<typeof buildCampaignMutationCtx>>
    >()

    async function getCampaignCtx(campaignId: Id<'campaigns'>) {
      const key = campaignId as string
      if (!processedCampaigns.has(key)) {
        try {
          const campaignCtx = await buildCampaignMutationCtx(ctx, campaignId)
          processedCampaigns.set(key, campaignCtx)
        } catch {
          return null
        }
      }
      return processedCampaigns.get(key) ?? null
    }

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
        // Skip if parent is also trashed (will be handled by cascade)
        if (folder.parentId) {
          const parent = await ctx.db.get(folder.parentId as Id<'folders'>)
          if (parent?.deletionTime) continue
        }
        const campaignCtx = await getCampaignCtx(campaignId)
        if (!campaignCtx) continue
        try {
          await applyToTree(
            campaignCtx,
            folder as AnySidebarItemFromDb,
            hardDeleteItem,
            { trashed: true },
          )
        } catch {
          // Item may have been deleted already by cascade
        }
      }

      // Delete leaf items (notes, maps, files)
      for (const items of expiredLeafItems) {
        for (const item of items) {
          const current = await ctx.db.get(item._id)
          if (!current) continue
          const campaignCtx = await getCampaignCtx(campaignId)
          if (!campaignCtx) continue
          try {
            await hardDeleteItem(campaignCtx, current as AnySidebarItemFromDb)
          } catch {
            // Item may have been deleted already
          }
        }
      }
    }

    return null
  },
})

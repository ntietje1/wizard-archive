import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id, TableNames } from '../../_generated/dataModel'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'

/**
 * Collects all dependent entities of a sidebar item (blocks, pins, shares,
 * bookmarks) and applies an operation to each one.
 *
 * This is the single source of truth for "which rows depend on a sidebar item",
 * used by trash, restore, and permanent-delete so they stay in sync.
 *
 * Note: file storage is NOT a dependent row — it lives on the file document
 * itself and must be handled separately by the caller when needed.
 */
export async function applyToDependents(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemFromDb,
  operation: (
    ctx: CampaignMutationCtx,
    doc: { _id: Id<TableNames> },
  ) => Promise<void>,
): Promise<void> {
  const campaignId = ctx.campaign._id

  // Type-specific dependents
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes: {
      const blocks = await ctx.db
        .query('blocks')
        .withIndex('by_campaign_note_block', (q) =>
          q.eq('campaignId', campaignId).eq('noteId', item._id),
        )
        .collect()
      for (const block of blocks) {
        await operation(ctx, block)
      }

      const blockShares = await ctx.db
        .query('blockShares')
        .withIndex('by_campaign_note', (q) =>
          q.eq('campaignId', campaignId).eq('noteId', item._id),
        )
        .collect()
      for (const blockShare of blockShares) {
        await operation(ctx, blockShare)
      }
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const pins = await ctx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', item._id))
        .collect()
      for (const pin of pins) {
        await operation(ctx, pin)
      }
      break
    }
  }

  // Shared dependents (all item types have shares and bookmarks)
  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', item._id),
    )
    .collect()
  for (const share of shares) {
    await operation(ctx, share)
  }

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_item', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', item._id),
    )
    .collect()
  for (const bookmark of bookmarks) {
    await operation(ctx, bookmark)
  }
}

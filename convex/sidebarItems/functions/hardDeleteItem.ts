import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { applyToDependents } from './applyToDependents'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'

/**
 * Hard-deletes a single sidebar item and all its dependent rows
 * (blocks, pins, shares, bookmarks, storage).
 *
 * Does NOT walk the tree — caller is responsible for that.
 * Does NOT check permissions — caller must have already authorized.
 */
export async function hardDeleteItem(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemFromDb,
): Promise<void> {
  // Clean up storage for files and maps
  if (item.type === SIDEBAR_ITEM_TYPES.files && item.storageId) {
    await ctx.storage.delete(item.storageId)
  }
  if (item.type === SIDEBAR_ITEM_TYPES.gameMaps && item.imageStorageId) {
    await ctx.storage.delete(item.imageStorageId)
  }

  await applyToDependents(ctx, item, async (ctx, doc) => {
    await ctx.db.delete(doc._id)
  })

  await ctx.db.delete(item._id)
}

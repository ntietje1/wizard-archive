import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { collectDescendants } from './collectDescendants'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemFromDb } from '../types/types'

type ItemOperation = (
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
) => Promise<void>

/**
 * Applies an operation to a sidebar item and, if it's a folder,
 * to all of its descendants. Descendants are processed first (leaves → root).
 *
 * This is the single source of truth for "do X to an item and its whole subtree",
 * used by trash, restore, and permanent-delete.
 */
export async function applyToTree(
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
  operation: ItemOperation,
  opts?: { location?: SidebarItemLocation },
): Promise<void> {
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    const descendants = await collectDescendants(ctx, {
      folderId: item._id,
      campaignId: item.campaignId,
      location: opts?.location ?? item.location,
    })

    for (const descendant of descendants) {
      await operation(ctx, descendant)
    }
  }

  await operation(ctx, item)
}

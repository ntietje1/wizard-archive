import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { collectDescendants } from './collectDescendants'
import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemFromDb } from '../types/types'

type ItemOperation = (
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
) => Promise<void>

export async function applyToTree(
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
  operation: ItemOperation,
): Promise<number> {
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    const descendants = await collectDescendants(ctx, {
      campaignId: item.campaignId,
      location: item.location,
      folderId: item._id,
    })

    for (const descendant of descendants) {
      await operation(ctx, descendant)
    }

    await operation(ctx, item)
    return descendants.length + 1
  }

  await operation(ctx, item)
  return 1
}

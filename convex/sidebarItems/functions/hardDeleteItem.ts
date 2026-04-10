import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemFromDb } from '../types/types'

export async function hardDeleteItem(ctx: MutationCtx, item: AnySidebarItemFromDb): Promise<void> {
  await ctx.db.delete('sidebarItems', item._id)
}

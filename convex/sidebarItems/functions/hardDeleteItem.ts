import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

// does NOT recursively delete children
export async function hardDeleteItem(ctx: MutationCtx, item: Doc<'sidebarItems'>): Promise<void> {
  await ctx.db.delete('sidebarItems', item._id)
}

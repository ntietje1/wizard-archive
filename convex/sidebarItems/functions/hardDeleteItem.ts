import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

export type SidebarTreeItemCore = {
  _id: Id<'sidebarItems'>
}

// does NOT recursively delete children
export async function hardDeleteItem(ctx: MutationCtx, item: SidebarTreeItemCore): Promise<void> {
  await ctx.db.delete('sidebarItems', item._id)
}

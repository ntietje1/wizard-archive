import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'

type SidebarTreeItemId = Pick<AnySidebarItemRow, '_id'>

// does NOT recursively delete children
export async function hardDeleteItem(ctx: MutationCtx, item: SidebarTreeItemId): Promise<void> {
  await ctx.db.delete('sidebarItems', item._id)
}

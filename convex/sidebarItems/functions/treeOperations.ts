import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { findUniqueSidebarItemSlug } from '../validation'
import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function trashTree(
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
  deletion: { deletionTime: number; deletedBy: Id<'userProfiles'> },
): Promise<number> {
  return applyToTree(ctx, item, async (_, i) => {
    await ctx.db.patch('sidebarItems', i._id, {
      location: SIDEBAR_ITEM_LOCATION.trash,
      deletionTime: deletion.deletionTime,
      deletedBy: deletion.deletedBy,
      parentId: i._id === item._id ? null : i.parentId,
    })
  })
}

export async function restoreTreeDescendants(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemFromDb,
  location: SidebarItemLocation,
): Promise<void> {
  await applyToTree(ctx, item, async (_, i) => {
    if (i._id === item._id) return
    if (i.location !== SIDEBAR_ITEM_LOCATION.trash) return

    const slug = await findUniqueSidebarItemSlug(ctx, {
      itemId: i._id,
      name: i.name,
    })
    await ctx.db.patch('sidebarItems', i._id, {
      deletionTime: null,
      deletedBy: null,
      location,
      slug,
    })
  })
}

export async function hardDeleteTree(
  ctx: MutationCtx,
  item: AnySidebarItemFromDb,
): Promise<number> {
  return applyToTree(ctx, item, hardDeleteItem)
}

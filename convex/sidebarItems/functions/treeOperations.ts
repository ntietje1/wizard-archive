import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { findUniqueSidebarItemSlug } from '../validation'
import { collectDescendants } from './collectDescendants'
import { hardDeleteItem } from './hardDeleteItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

type ItemOperation = (ctx: MutationCtx, item: Doc<'sidebarItems'>) => Promise<void>

async function applyToTree(
  ctx: MutationCtx,
  item: Doc<'sidebarItems'>,
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

export async function trashTree(
  ctx: MutationCtx,
  item: Doc<'sidebarItems'>,
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
  item: Doc<'sidebarItems'>,
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

export async function hardDeleteTree(ctx: MutationCtx, item: Doc<'sidebarItems'>): Promise<number> {
  return applyToTree(ctx, item, hardDeleteItem)
}

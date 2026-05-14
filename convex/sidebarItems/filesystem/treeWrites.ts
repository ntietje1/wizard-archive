import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { findUniqueSidebarItemSlug } from '../validation/orchestration'
import { collectDescendants } from '../functions/collectDescendants'
import {
  assertSidebarItemLifecycleConsistency,
  getSidebarItemStatus,
  isTrashedSidebarItem,
} from '../types/status'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemFieldPatch } from './receipts'

type ItemOperation = (ctx: MutationCtx, item: AnySidebarItemRow) => Promise<void>
export type TrashTreePatch = Required<
  Pick<SidebarItemFieldPatch, 'status' | 'deletionTime' | 'deletedBy' | 'parentId'>
>

async function applyToTree(
  ctx: MutationCtx,
  item: AnySidebarItemRow,
  operation: ItemOperation,
): Promise<number> {
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    const descendants = await collectDescendants(ctx, {
      campaignId: item.campaignId,
      status: getSidebarItemStatus(item),
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
  item: AnySidebarItemRow,
  deletion: { deletionTime: number; deletedBy: Id<'userProfiles'> },
): Promise<number> {
  return applyToTree(ctx, item, async (_, i) => {
    const patch: TrashTreePatch = {
      status: SIDEBAR_ITEM_STATUS.trashed,
      deletionTime: deletion.deletionTime,
      deletedBy: deletion.deletedBy,
      parentId: i._id === item._id ? null : i.parentId,
    }
    assertSidebarItemLifecycleConsistency({ ...i, ...patch })
    await ctx.db.patch('sidebarItems', i._id, patch)
  })
}

export async function restoreTreeDescendants(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemRow,
): Promise<Array<AnySidebarItemRow>> {
  const restored: Array<AnySidebarItemRow> = []
  await applyToTree(ctx, item, async (_, i) => {
    if (i._id === item._id) return
    if (!isTrashedSidebarItem(i)) return

    const name = i.name as SidebarItemName
    const slug = await findUniqueSidebarItemSlug(ctx, {
      itemId: i._id,
      name,
    })
    const patch = {
      deletionTime: null,
      deletedBy: null,
      status: SIDEBAR_ITEM_STATUS.active,
      slug,
    }
    assertSidebarItemLifecycleConsistency({ ...i, ...patch })
    await ctx.db.patch('sidebarItems', i._id, patch)
    const restoredItem = await ctx.db.get('sidebarItems', i._id)
    if (restoredItem) restored.push(restoredItem)
  })
  return restored
}

export async function hardDeleteTree(ctx: MutationCtx, item: AnySidebarItemRow): Promise<number> {
  return applyToTree(ctx, item, (_, i) => ctx.db.delete('sidebarItems', i._id))
}

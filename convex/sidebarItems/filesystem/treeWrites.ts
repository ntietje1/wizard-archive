import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { findUniqueSidebarItemSlug } from '../validation/orchestration'
import { collectDescendants } from '../functions/collectDescendants'
import {
  isTrashedSidebarItem,
  toSidebarItemDocument,
  toSidebarItemReplacement,
} from '../types/status'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

type StoredSidebarItemRow = Doc<'sidebarItems'>
type ItemOperation = (ctx: MutationCtx, item: StoredSidebarItemRow) => Promise<void>
export type TrashTreePatch = Required<
  Pick<StoredSidebarItemRow, 'status' | 'deletionTime' | 'deletedBy' | 'parentId'>
>

async function applyToTree(
  ctx: MutationCtx,
  item: StoredSidebarItemRow,
  operation: ItemOperation,
): Promise<number> {
  if (item.type === RESOURCE_TYPES.folders) {
    const descendants = await collectDescendants(ctx, {
      campaignId: item.campaignId,
      status: item.status,
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
  item: StoredSidebarItemRow,
  deletion: { deletionTime: number; deletedBy: Id<'userProfiles'> },
): Promise<number> {
  return applyToTree(ctx, item, async (_, i) => {
    const patch: TrashTreePatch = {
      status: RESOURCE_STATUS.trashed,
      deletionTime: deletion.deletionTime,
      deletedBy: deletion.deletedBy,
      parentId: i._id === item._id ? null : i.parentId,
    }
    const trashed = toSidebarItemDocument({ ...i, ...patch })
    await ctx.db.replace('sidebarItems', i._id, toSidebarItemReplacement(trashed))
  })
}

export async function restoreTreeDescendants(
  ctx: CampaignMutationCtx,
  item: StoredSidebarItemRow,
): Promise<Array<StoredSidebarItemRow>> {
  const restored: Array<StoredSidebarItemRow> = []
  await applyToTree(ctx, item, async (_, i) => {
    if (i._id === item._id) return
    if (!isTrashedSidebarItem(i)) return

    const name = i.name as ResourceTitle
    const slug = await findUniqueSidebarItemSlug(ctx, {
      itemId: i._id,
      name,
    })
    const patch = {
      deletionTime: null,
      deletedBy: null,
      status: RESOURCE_STATUS.active,
      slug,
    }
    const restoredItem = toSidebarItemDocument({ ...i, ...patch })
    await ctx.db.replace('sidebarItems', i._id, toSidebarItemReplacement(restoredItem))
    restored.push(restoredItem)
  })
  return restored
}

export async function hardDeleteTree(
  ctx: MutationCtx,
  item: StoredSidebarItemRow,
): Promise<number> {
  return applyToTree(ctx, item, (_, i) => ctx.db.delete('sidebarItems', i._id))
}

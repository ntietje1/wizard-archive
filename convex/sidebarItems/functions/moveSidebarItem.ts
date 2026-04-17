import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import {
  findUniqueSidebarItemSlug,
  validateSidebarMove,
  validateSidebarParentChange,
} from '../validation/orchestration'
import { requireItemAccess } from '../validation/access'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { resyncNoteLinksForNotes } from '../../links/functions/resyncNoteLinksForNotes'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { deduplicateName } from './defaultItemName'
import { trashTree, restoreTreeDescendants } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import { collectDescendants } from './collectDescendants'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItemRow } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemSlug } from '../validation/slug'

const clearDeletion = { deletionTime: null, deletedBy: null }

async function resyncRelativeLinksForMovedItems(
  ctx: CampaignMutationCtx,
  {
    item,
    location,
  }: {
    item: AnySidebarItemRow
    location: SidebarItemLocation
  },
): Promise<void> {
  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    await resyncNoteLinksForNotes(ctx, { noteIds: [item._id] })
    return
  }

  if (item.type !== SIDEBAR_ITEM_TYPES.folders) {
    return
  }

  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    location,
    folderId: item._id,
  })
  const descendantNoteIds = descendants
    .filter((descendant) => descendant.type === SIDEBAR_ITEM_TYPES.notes)
    .map((descendant) => descendant._id)

  await resyncNoteLinksForNotes(ctx, { noteIds: descendantNoteIds })
}

/**
 * Resolves name/slug conflicts for an item being restored.
 * Returns a patch object with the unique name/slug if they differ from current.
 */
async function resolveRestoreConflicts(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemRow,
): Promise<{ name?: SidebarItemName; slug?: SidebarItemSlug }> {
  const siblings = await getSidebarItemsByParent(ctx, {
    parentId: item.parentId,
  })
  const otherNames = siblings.filter((s) => s._id !== item._id).map((s) => s.name)

  const uniqueName = deduplicateName(item.name, otherNames) as SidebarItemName
  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    itemId: item._id,
    name: uniqueName,
  })

  const patch: { name?: SidebarItemName; slug?: SidebarItemSlug } = {}
  if (uniqueName !== item.name) patch.name = uniqueName
  if (uniqueSlug !== item.slug) patch.slug = uniqueSlug
  return patch
}

export async function moveSidebarItem(
  ctx: CampaignMutationCtx,
  {
    itemId,
    location,
    parentId,
  }: {
    itemId: Id<'sidebarItems'>
    location?: SidebarItemLocation
    parentId?: Id<'sidebarItems'> | null
  },
): Promise<Id<'sidebarItems'>> {
  const itemFromDb = await getSidebarItem(ctx, itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const isRelocating = location !== undefined && location !== item.location
  const isTrashing = isRelocating && location === SIDEBAR_ITEM_LOCATION.trash
  const isRestoring = isRelocating && item.location === SIDEBAR_ITEM_LOCATION.trash
  const isMoving = parentId !== undefined

  if (isRelocating && !isTrashing && !isRestoring) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This move is not supported')
  }

  // --- Relocate: entering trash ---
  if (isTrashing) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can trash folders')
    }

    await trashTree(ctx, item, {
      deletionTime: Date.now(),
      deletedBy: ctx.membership.userId,
    })

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      action: EDIT_HISTORY_ACTION.trashed,
    })
  }

  // --- Relocate: leaving trash ---
  if (isRestoring) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can restore folders')
    }
    if (location === undefined)
      throw new Error('Invariant: location must be defined when restoring')

    const restoreParentId = parentId ?? null

    await validateSidebarParentChange(ctx, {
      item: { ...item, location },
      newParentId: restoreParentId,
    })

    const itemForRestore = { ...item, parentId: restoreParentId }
    const conflictPatch = await resolveRestoreConflicts(ctx, itemForRestore)

    await ctx.db.patch('sidebarItems', itemId, {
      ...clearDeletion,
      ...conflictPatch,
      location: location,
      parentId: restoreParentId,
    })

    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      await restoreTreeDescendants(ctx, item, location)
    }

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      action: EDIT_HISTORY_ACTION.restored,
    })

    await resyncRelativeLinksForMovedItems(ctx, {
      item,
      location,
    })
  }

  // --- Move (within same location) ---
  if (isMoving && !isRelocating) {
    await validateSidebarMove(ctx, { item, newParentId: parentId })

    const oldParent = item.parentId ? await ctx.db.get('sidebarItems', item.parentId) : null
    const newParent = parentId ? await ctx.db.get('sidebarItems', parentId) : null

    await ctx.db.patch('sidebarItems', itemId, {
      parentId: parentId,
      updatedTime: Date.now(),
      updatedBy: ctx.membership.userId,
    })

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      action: EDIT_HISTORY_ACTION.moved,
      metadata: {
        from: oldParent?.name ?? null,
        to: newParent?.name ?? null,
      },
    })

    await resyncRelativeLinksForMovedItems(ctx, {
      item,
      location: item.location,
    })
  }

  return item._id
}

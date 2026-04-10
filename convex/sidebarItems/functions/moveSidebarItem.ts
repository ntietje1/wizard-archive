import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import {
  findUniqueSidebarItemSlug,
  requireItemAccess,
  validateSidebarMove,
  validateSidebarParentChange,
} from '../validation'
import { requireCampaignMembership } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { deduplicateName } from './defaultItemName'
import { trashTree, restoreTreeDescendants } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import type { SidebarItemId, SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItemFromDb } from '../types/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

const clearDeletion = { deletionTime: null, deletedBy: null }

/**
 * Resolves name/slug conflicts for an item being restored.
 * Returns a patch object with the unique name/slug if they differ from current.
 */
async function resolveRestoreConflicts(
  ctx: AuthMutationCtx,
  item: AnySidebarItemFromDb,
): Promise<{ name?: string; slug?: string }> {
  const campaignId = item.campaignId
  const siblings = await getSidebarItemsByParent(ctx, {
    campaignId,
    parentId: item.parentId,
  })
  const otherNames = siblings.filter((s) => s._id !== item._id).map((s) => s.name)

  const uniqueName = deduplicateName(item.name, otherNames)
  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    campaignId,
    itemId: item._id,
    name: uniqueName,
  })

  const patch: { name?: string; slug?: string } = {}
  if (uniqueName !== item.name) patch.name = uniqueName
  if (uniqueSlug !== item.slug) patch.slug = uniqueSlug
  return patch
}

export async function moveSidebarItem(
  ctx: AuthMutationCtx,
  {
    itemId,
    location,
    parentId,
  }: {
    itemId: SidebarItemId
    location?: SidebarItemLocation
    parentId?: Id<'sidebarItems'> | null
  },
): Promise<SidebarItemId> {
  const itemFromDb = await getSidebarItem(ctx, itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const campaignId = item.campaignId
  const { membership } = await requireCampaignMembership(ctx, campaignId)

  const isRelocating = location !== undefined && location !== item.location
  const isTrashing = isRelocating && location === SIDEBAR_ITEM_LOCATION.trash
  const isRestoring = isRelocating && item.location === SIDEBAR_ITEM_LOCATION.trash
  const isMoving = parentId !== undefined

  if (isRelocating && !isTrashing && !isRestoring) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This move is not supported')
  }

  // --- Relocate: entering trash ---
  if (isTrashing) {
    if (item.type === SIDEBAR_ITEM_TYPES.folders && membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can trash folders')
    }

    await trashTree(ctx, item, {
      deletionTime: Date.now(),
      deletedBy: ctx.user.profile._id,
    })

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      campaignId,
      action: EDIT_HISTORY_ACTION.trashed,
    })
  }

  // --- Relocate: leaving trash ---
  if (isRestoring) {
    if (item.type === SIDEBAR_ITEM_TYPES.folders && membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can restore folders')
    }

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
      await restoreTreeDescendants(ctx, item, location!)
    }

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      campaignId,
      action: EDIT_HISTORY_ACTION.restored,
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
      updatedBy: ctx.user.profile._id,
    })

    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      campaignId,
      action: EDIT_HISTORY_ACTION.moved,
      metadata: {
        from: oldParent?.name ?? null,
        to: newParent?.name ?? null,
      },
    })
  }

  return item._id
}

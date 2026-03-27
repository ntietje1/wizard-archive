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
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { deduplicateName } from './defaultItemName'
import { applyToTree } from './applyToTree'
import { applyToDependents } from './applyToDependents'
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
  const otherNames = siblings
    .filter((s) => s._id !== item._id)
    .map((s) => s.name)

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
    parentId?: Id<'folders'> | null
  },
): Promise<SidebarItemId> {
  const itemFromDb = await ctx.db.get(itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const campaignId = item.campaignId
  const { membership } = await requireCampaignMembership(ctx, campaignId)

  const isRelocating = location !== undefined && location !== item.location
  const isTrashing = isRelocating && location === SIDEBAR_ITEM_LOCATION.trash
  const isRestoring =
    isRelocating && item.location === SIDEBAR_ITEM_LOCATION.trash
  const isMoving = parentId !== undefined

  if (isRelocating && !isTrashing && !isRestoring) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This move is not supported')
  }

  // --- Relocate: entering trash ---
  if (isTrashing) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'Only the DM can trash folders',
      )
    }

    const now = Date.now()
    const deletedBy = ctx.user.profile._id

    await applyToTree(ctx, item, async (_, i) => {
      await applyToDependents(ctx, i, async (_, doc) => {
        await ctx.db.patch(doc._id, { deletionTime: now, deletedBy })
      })
      const isRoot = i._id === item._id
      await ctx.db.patch(i._id, {
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: now,
        deletedBy,
        ...(isRoot ? { parentId: null } : {}),
      })
    })
  }

  // --- Relocate: leaving trash ---
  if (isRestoring) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'Only the DM can restore folders',
      )
    }

    const restoreParentId = parentId ?? null

    await validateSidebarParentChange(ctx, {
      item: { ...item, location },
      newParentId: restoreParentId,
    })

    const itemForRestore = { ...item, parentId: restoreParentId }
    const conflictPatch = await resolveRestoreConflicts(ctx, itemForRestore)

    // Restore root item + its dependents
    await applyToDependents(ctx, item, async (_, doc) => {
      await ctx.db.patch(doc._id, clearDeletion)
    })
    await ctx.db.patch(itemId, {
      ...clearDeletion,
      ...conflictPatch,
      location: location,
      parentId: restoreParentId,
    })

    // Restore all descendants if folder
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      await applyToTree(ctx, item, async (_, i) => {
        if (i._id === item._id) return
        if (i.location !== SIDEBAR_ITEM_LOCATION.trash) return

        await applyToDependents(ctx, i, async (_, doc) => {
          await ctx.db.patch(doc._id, clearDeletion)
        })

        const descSlug = await findUniqueSidebarItemSlug(ctx, {
          campaignId,
          itemId: i._id,
          name: i.name,
        })
        await ctx.db.patch(i._id, {
          ...clearDeletion,
          location: location,
          ...(descSlug !== i.slug ? { slug: descSlug } : {}),
        })
      })
    }
  }

  // --- Move (within same location) ---
  if (isMoving && !isRelocating) {
    await validateSidebarMove(ctx, { item, newParentId: parentId })

    await ctx.db.patch(itemId, {
      parentId: parentId,
      updatedTime: Date.now(),
      updatedBy: ctx.user.profile._id,
    })
  }

  return item._id
}

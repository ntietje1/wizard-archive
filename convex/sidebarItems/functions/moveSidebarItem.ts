import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import {
  findUniqueSidebarItemSlug,
  requireItemAccess,
  validateSidebarMove,
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

const clearDeletion = { deletionTime: undefined, deletedBy: undefined }

/**
 * Resolves name/slug conflicts for an item being restored.
 * Returns a patch object with the unique name/slug if they differ from current.
 */
async function resolveRestoreConflicts(
  ctx: AuthMutationCtx,
  item: AnySidebarItemFromDb,
): Promise<Record<string, unknown>> {
  const campaignId = item.campaignId
  const siblings = await getSidebarItemsByParent(ctx, {
    parentId: item.parentId,
    campaignId,
  })
  const otherNames = siblings
    .filter((s) => s._id !== item._id)
    .map((s) => s.name)

  const uniqueName = deduplicateName(item.name, otherNames)
  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name: uniqueName,
    itemId: item._id,
    campaignId,
  })

  const patch: Record<string, unknown> = {}
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
    throw new Error(
      `Unsupported location transition: ${item.location} -> ${location}`,
    )
  }

  // --- Relocate: entering trash ---
  if (isTrashing) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throw new Error('Only the DM can trash folders')
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
      throw new Error('Only the DM can restore folders')
    }

    const restoreParentId = parentId ?? null

    // Resolve name/slug conflicts for the root item at its restore destination
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
      await applyToTree(
        ctx,
        item,
        async (_, i) => {
          if (i._id === item._id) return
          if (i.location !== SIDEBAR_ITEM_LOCATION.trash) return

          await applyToDependents(ctx, i, async (_, doc) => {
            await ctx.db.patch(doc._id, clearDeletion)
          })

          const descSlug = await findUniqueSidebarItemSlug(ctx, {
            name: i.name,
            itemId: i._id,
            campaignId,
          })
          await ctx.db.patch(i._id, {
            ...clearDeletion,
            location: location,
            ...(descSlug !== i.slug ? { slug: descSlug } : {}),
          })
        },
        { location: SIDEBAR_ITEM_LOCATION.trash },
      )
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

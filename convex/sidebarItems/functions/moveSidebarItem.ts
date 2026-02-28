import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import {
  findUniqueSidebarItemSlug,
  requireItemAccess,
  validateSidebarMove,
} from '../validation'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { deduplicateName } from './defaultItemName'
import { applyToTree } from './applyToTree'
import { applyToDependents } from './applyToDependents'
import type { SidebarItemId } from '../types/baseTypes'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'
import type { FolderFromDb } from '../../folders/types'
import type { Id } from '../../_generated/dataModel'

const clearDeletion = { deletionTime: undefined, deletedBy: undefined }

/**
 * Resolves name/slug conflicts for an item being restored.
 * Returns a patch object with the unique name/slug if they differ from current.
 */
async function resolveRestoreConflicts(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemFromDb,
): Promise<Record<string, unknown>> {
  const siblings = await getSidebarItemsByParent(ctx, {
    parentId: item.parentId,
  })
  const otherNames = siblings
    .filter((s) => s._id !== item._id)
    .map((s) => s.name)

  const uniqueName = deduplicateName(item.name, otherNames)
  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    type: item.type,
    name: uniqueName,
    itemId: item._id,
  })

  const patch: Record<string, unknown> = {}
  if (uniqueName !== item.name) patch.name = uniqueName
  if (uniqueSlug !== item.slug) patch.slug = uniqueSlug
  return patch
}

export async function moveSidebarItem(
  ctx: CampaignMutationCtx,
  {
    itemId,
    parentId,
    deleted,
  }: {
    itemId: SidebarItemId
    parentId?: Id<'folders'>
    deleted?: boolean
  },
): Promise<SidebarItemId> {
  const itemFromDb = await ctx.db.get(itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const isTrashing = deleted === true && !item.deletionTime
  const isRestoring = deleted === false && !!item.deletionTime
  const isMoving = parentId !== undefined

  // --- Trash ---
  if (isTrashing) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throw new Error('Only the DM can trash folders')
    }

    const now = Date.now()
    const deletedBy = ctx.user.profile._id

    await applyToTree(ctx, item, async (ctx, i) => {
      await applyToDependents(ctx, i, async (ctx, doc) => {
        await ctx.db.patch(doc._id, { deletionTime: now, deletedBy })
      })
      await ctx.db.patch(i._id, { deletionTime: now, deletedBy })
    })
  }

  // --- Restore ---
  if (isRestoring) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throw new Error('Only the DM can restore folders')
    }

    // If original parent is trashed, reparent to root
    if (item.parentId) {
      const parent = (await ctx.db.get(item.parentId)) as FolderFromDb | null
      if (parent?.deletionTime) {
        await ctx.db.patch(itemId, { parentId: null })
      }
    }

    // Resolve name/slug conflicts for the root item
    const freshItem = (await ctx.db.get(itemId)) as AnySidebarItemFromDb
    const conflictPatch = await resolveRestoreConflicts(ctx, freshItem)

    // Restore root item + its dependents
    await applyToDependents(ctx, freshItem, async (ctx, doc) => {
      await ctx.db.patch(doc._id, clearDeletion)
    })
    await ctx.db.patch(itemId, { ...clearDeletion, ...conflictPatch })

    // Restore all descendants if folder
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      await applyToTree(
        ctx,
        freshItem,
        async (ctx, i) => {
          if (i._id === freshItem._id) return // root already handled above
          if (!i.deletionTime) return

          await applyToDependents(ctx, i, async (ctx, doc) => {
            await ctx.db.patch(doc._id, clearDeletion)
          })

          // Slugs are campaign-global, so descendants need deduplication too
          const descSlug = await findUniqueSidebarItemSlug(ctx, {
            type: i.type,
            name: i.name,
            itemId: i._id,
          })
          await ctx.db.patch(i._id, {
            ...clearDeletion,
            ...(descSlug !== i.slug ? { slug: descSlug } : {}),
          })
        },
        { trashed: true },
      )
    }
  }

  // --- Move ---
  if (isMoving) {
    // Re-fetch after potential trash/restore to get current state for validation
    const currentItem =
      isTrashing || isRestoring
        ? await requireItemAccess(ctx, {
            rawItem: await ctx.db.get(itemId),
            requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
          })
        : item

    await validateSidebarMove(ctx, { item: currentItem, newParentId: parentId })

    await ctx.db.patch(itemId, {
      parentId: parentId ?? null,
      updatedTime: Date.now(),
      updatedBy: ctx.user.profile._id,
    })
  }

  return item._id
}

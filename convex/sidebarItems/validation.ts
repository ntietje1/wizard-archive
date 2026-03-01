import { getSidebarItemPermissionLevel } from '../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../permissions/types'
import { findUniqueSlug } from '../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemsByParent } from './functions/getSidebarItemsByParent'
import { getSidebarItemById } from './functions/getSidebarItemById'
import { enhanceSidebarItem } from './functions/enhanceSidebarItem'
import { checkNameConflict, validateItemName } from './sharedValidation'
import { SIDEBAR_ITEM_TYPES } from './types/baseTypes'
import type { SidebarItemId, SidebarItemType } from './types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { FolderFromDb } from '../folders/types'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  EnhancedSidebarItem,
} from './types/types'

export type { ValidationResult } from './sharedValidation'
export { validateItemName } from './sharedValidation'

/**
 * Checks if a name is unique under a parent (case-insensitive).
 * Fetches all siblings and delegates to shared checkNameConflict.
 */
export async function checkUniqueNameUnderParent(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
    excludeId,
  }: {
    parentId: Id<'folders'> | null | undefined
    name: string
    excludeId?: SidebarItemId
  },
): Promise<{ valid: boolean; error?: string }> {
  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  return checkNameConflict(name, siblings, excludeId)
}

/**
 * Walks up the parent chain to check if setting newParentId would create a cycle.
 * Server version uses async ctx.db.get lookups.
 */
export async function validateNoCircularParent(
  ctx: CampaignQueryCtx,
  {
    itemId,
    newParentId,
  }: {
    itemId: SidebarItemId
    newParentId: Id<'folders'> | null | undefined
  },
): Promise<{ valid: boolean; error?: string }> {
  if (!newParentId) {
    return { valid: true }
  }

  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  const seen = new Set<Id<'folders'>>()
  let currentId: Id<'folders'> | null = newParentId

  while (currentId) {
    if (seen.has(currentId)) {
      break
    }
    seen.add(currentId)

    if (currentId === itemId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current: FolderFromDb | null = await ctx.db.get(currentId)
    currentId = current?.parentId ?? null
  }

  return { valid: true }
}

/**
 * Validates a sidebar item name (format + uniqueness).
 * Throws an error if validation fails.
 * Returns siblings so callers can reuse them (e.g. for default name generation).
 */
export async function validateSidebarItemName(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
    excludeId,
  }: {
    parentId: Id<'folders'> | null | undefined
    name: string
    excludeId?: SidebarItemId
  },
): Promise<{ siblings: Array<AnySidebarItem> }> {
  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    throw new Error(nameResult.error)
  }

  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  const uniqueResult = checkNameConflict(name, siblings, excludeId)
  if (!uniqueResult.valid) {
    throw new Error(uniqueResult.error)
  }

  return { siblings }
}

/**
 * Validates that a parent change won't create a circular reference
 * and that the user has full access to the target folder.
 * Throws an error if validation fails.
 */
export async function validateSidebarParentChange(
  ctx: CampaignQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: AnySidebarItem
    newParentId: Id<'folders'> | null | undefined
  },
): Promise<void> {
  const result = await validateNoCircularParent(ctx, {
    itemId: item._id,
    newParentId,
  })
  if (!result.valid) {
    throw new Error(result.error)
  }
  if (newParentId) {
    const parentFromDb = await ctx.db.get(newParentId)
    if (parentFromDb?.deletionTime) {
      throw new Error('Cannot move items into a trashed folder')
    }
    await requireItemAccess(ctx, {
      rawItem: parentFromDb,
      requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
  }
}

/**
 * Validates that the parent exists and the user has full access,
 * or that the user is a DM for root-level creation.
 * Throws if validation fails.
 */
export async function validateSidebarCreateParent(
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'folders'> | null | undefined },
): Promise<void> {
  if (parentId) {
    const parentItem = await getSidebarItemById(ctx, { id: parentId })
    if (!parentItem) {
      throw new Error('Parent not found')
    }
    const level = await getSidebarItemPermissionLevel(ctx, { item: parentItem })
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.FULL_ACCESS)) {
      throw new Error('You do not have sufficient permission for this item')
    }
  } else {
    if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      throw new Error('Only the DM can create items at the root level')
    }
  }
}

/**
 * Validates all preconditions for moving a sidebar item:
 * circular refs, target parent access, and name uniqueness.
 * The caller is responsible for checking permission on the item itself.
 */
export async function validateSidebarMove(
  ctx: CampaignQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: AnySidebarItem
    newParentId: Id<'folders'> | null | undefined
  },
): Promise<void> {
  await validateSidebarParentChange(ctx, { item, newParentId })

  await validateSidebarItemName(ctx, {
    parentId: newParentId,
    name: item.name,
    excludeId: item._id,
  })
}

/**
 * Enhances a sidebar item and checks if the user has the required
 * permission level. Returns null if the item doesn't exist or
 * the user lacks permission.
 */
export async function checkItemAccess<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<EnhancedSidebarItem<T> | null> {
  if (!rawItem) return null
  const item = await enhanceSidebarItem(ctx, { item: rawItem })
  const level = await getSidebarItemPermissionLevel(ctx, { item })
  if (!hasAtLeastPermissionLevel(level, requiredLevel)) {
    return null
  }
  return item
}

/**
 * Like checkItemAccess, but throws if the item doesn't exist,
 * fails the campaign check, or lacks the required permission.
 */
export async function requireItemAccess<T extends AnySidebarItemFromDb>(
  ctx: CampaignQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<EnhancedSidebarItem<T>> {
  if (!rawItem || rawItem.campaignId !== ctx.campaign._id) {
    throw new Error('Item not found')
  }
  const item = await checkItemAccess(ctx, { rawItem, requiredLevel })
  if (!item) {
    throw new Error('You do not have sufficient permission for this item')
  }
  return item
}

async function checkSlugConflict(
  ctx: CampaignMutationCtx,
  {
    type,
    slug,
    excludeId,
  }: {
    type: SidebarItemType
    slug: string
    excludeId?: SidebarItemId
  },
): Promise<boolean> {
  const campaignId = ctx.campaign._id

  let query
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      query = ctx.db.query('notes')
      break
    case SIDEBAR_ITEM_TYPES.folders:
      query = ctx.db.query('folders')
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      query = ctx.db.query('gameMaps')
      break
    case SIDEBAR_ITEM_TYPES.files:
      query = ctx.db.query('files')
      break
    default:
      throw new Error(`Invalid sidebar item type: ${type satisfies never}`)
  }
  return query
    .withIndex('by_campaign_slug', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('slug', slug)
        .eq('deletionTime', undefined),
    )
    .unique()
    .then((conflict) =>
      excludeId
        ? conflict !== null && conflict._id !== excludeId
        : conflict !== null,
    )
}

export async function findUniqueSidebarItemSlug(
  ctx: CampaignMutationCtx,
  {
    type,
    name,
    itemId,
  }: {
    type: SidebarItemType
    name: string
    itemId: SidebarItemId
  },
): Promise<string> {
  return findUniqueSlug(name, (slug) =>
    checkSlugConflict(ctx, { type, slug, excludeId: itemId }),
  )
}

export async function findNewSidebarItemSlug(
  ctx: CampaignMutationCtx,
  {
    type,
    name,
  }: {
    type: SidebarItemType
    name: string
  },
): Promise<string> {
  return findUniqueSlug(name, (slug) => checkSlugConflict(ctx, { type, slug }))
}

/**
 * Validates a name change and generates a new unique slug.
 * Combines name validation (wiki-link + uniqueness) with slug generation.
 * Returns the new slug.
 */
export async function validateSidebarItemRename(
  ctx: CampaignMutationCtx,
  {
    item,
    newName,
  }: {
    item: AnySidebarItem
    newName: string
  },
): Promise<string> {
  const trimmedName = newName.trim()
  await validateSidebarItemName(ctx, {
    parentId: item.parentId,
    name: trimmedName,
    excludeId: item._id,
  })

  return findUniqueSidebarItemSlug(ctx, {
    type: item.type,
    name: trimmedName,
    itemId: item._id,
  })
}

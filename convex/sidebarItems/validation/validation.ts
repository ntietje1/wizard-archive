import { ERROR_CODE, throwClientError } from '../../errors'
import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { findUniqueSlug } from '../../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getSidebarItemsByParent } from '../functions/getSidebarItemsByParent'
import { enhanceSidebarItem } from '../functions/enhanceSidebarItem'
import { assertSidebarItemName, checkNameConflict } from './name'
import { assertSidebarItemSlug, validateSidebarItemSlug } from './slug'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemName, ValidationResult } from './name'
import type { PermissionLevel } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { SidebarItemSlug } from './slug'
import type { AnySidebarItem, AnySidebarItemFromDb, EnhancedSidebarItem } from '../types/types'
import { getSidebarItemWithContent } from '../functions/getSidebarItemWithContent'

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
    parentId: Id<'sidebarItems'> | null
    name: string
    excludeId?: Id<'sidebarItems'>
  },
): Promise<ValidationResult> {
  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  return checkNameConflict(name, siblings, excludeId)
}

async function ensureSidebarItemNameAvailable(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
    excludeId,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
    excludeId?: Id<'sidebarItems'>
  },
): Promise<{ siblings: Array<AnySidebarItem> }> {
  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  const uniqueResult = checkNameConflict(name, siblings, excludeId)
  if (!uniqueResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, uniqueResult.error)
  }

  return { siblings }
}

/**
 * Walks up the parent chain to check if setting newParentId would create a cycle.
 * Server version uses async ctx.db.get lookups.
 */
async function validateNoCircularParentInDb(
  ctx: CampaignQueryCtx,
  {
    itemId,
    newParentId,
  }: {
    itemId: Id<'sidebarItems'>
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<ValidationResult> {
  if (!newParentId) {
    return { valid: true }
  }

  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  const seen = new Set<Id<'sidebarItems'>>()
  let currentId: Id<'sidebarItems'> | null = newParentId

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

    const current: Doc<'sidebarItems'> | null = await ctx.db.get('sidebarItems', currentId)
    currentId = current?.parentId ?? null
  }

  return { valid: true }
}

/**
 * Validates a sidebar item name (format + uniqueness).
 * Throws an error if validation fails.
 * Returns siblings so callers can reuse them (e.g. for default name generation).
 */
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
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  const result = await validateNoCircularParentInDb(ctx, {
    itemId: item._id,
    newParentId,
  })
  if (!result.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, result.error)
  }
  if (newParentId) {
    const parentFromDb = await ctx.db.get('sidebarItems', newParentId)
    if (parentFromDb && parentFromDb.type !== SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Parent must be a folder')
    }
    if (parentFromDb && parentFromDb.location !== item.location) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Cannot move items into a folder in a different location',
      )
    }
    await requireItemAccess(ctx, {
      rawItem: parentFromDb as AnySidebarItemFromDb | null,
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
  { parentId }: { parentId: Id<'sidebarItems'> | null },
): Promise<void> {
  const { membership } = ctx
  if (parentId) {
    const parentItem = await getSidebarItemWithContent(ctx, parentId)
    if (!parentItem) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    if (parentItem.type !== SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Parent must be a folder')
    }
    const level = await getSidebarItemPermissionLevel(ctx, { item: parentItem })
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.FULL_ACCESS)) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'You do not have sufficient permission for this item',
      )
    }
  } else {
    if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'Only the DM can create items at the root level',
      )
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
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  await validateSidebarParentChange(ctx, { item, newParentId })

  await ensureSidebarItemNameAvailable(ctx, {
    parentId: newParentId,
    name: assertSidebarItemName(item.name),
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
  if (!hasAtLeastPermissionLevel(item.myPermissionLevel, requiredLevel)) {
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
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }
  const item = await checkItemAccess(ctx, { rawItem, requiredLevel })
  if (!item) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'You do not have sufficient permission for this item',
    )
  }
  return item
}

async function checkSlugConflict(
  ctx: CampaignQueryCtx,
  {
    campaignId,
    slug,
    excludeId,
  }: {
    campaignId: Id<'campaigns'>
    slug: string
    excludeId?: Id<'sidebarItems'>
  },
): Promise<boolean> {
  const conflict = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId).eq('slug', slug))
    .unique()
  if (!conflict) return false
  return excludeId ? conflict._id !== excludeId : true
}

export async function findUniqueSidebarItemSlug(
  ctx: CampaignQueryCtx,
  {
    itemId,
    name,
  }: {
    itemId?: Id<'sidebarItems'>
    name: SidebarItemName
  },
): Promise<SidebarItemSlug> {
  try {
    const candidateSlug = await findUniqueSlug(
      name,
      (candidate) =>
        checkSlugConflict(ctx, {
          campaignId: ctx.campaign._id,
          slug: candidate,
          excludeId: itemId,
        }),
      {
        isValidCandidate: (candidate) => validateSidebarItemSlug(candidate) === null,
      },
    )
    return assertSidebarItemSlug(candidateSlug)
  } catch {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Failed to generate a valid slug for this item')
  }
}

export async function prepareSidebarItemCreate(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
  },
): Promise<{ name: string; slug: SidebarItemSlug }> {
  await validateSidebarCreateParent(ctx, { parentId })
  await ensureSidebarItemNameAvailable(ctx, {
    parentId,
    name,
  })

  const slug = await findUniqueSidebarItemSlug(ctx, {
    name,
  })

  return { name, slug }
}

/**
 * Validates a name change and generates a new unique slug.
 * Combines name validation (wiki-link + uniqueness) with slug generation.
 * Returns null when the trimmed name is unchanged.
 */
export async function prepareSidebarItemRename(
  ctx: CampaignQueryCtx,
  {
    item,
    newName,
  }: {
    item: AnySidebarItem
    newName: SidebarItemName
  },
): Promise<{ name: string; slug: SidebarItemSlug } | null> {
  if (newName === item.name) {
    return null
  }

  await ensureSidebarItemNameAvailable(ctx, {
    parentId: item.parentId,
    name: newName,
    excludeId: item._id,
  })

  const slug = await findUniqueSidebarItemSlug(ctx, {
    itemId: item._id,
    name: newName,
  })

  return { name: newName, slug }
}

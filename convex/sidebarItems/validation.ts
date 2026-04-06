import { ERROR_CODE, throwClientError } from '../errors'
import { getSidebarItemPermissionLevel } from '../sidebarShares/functions/sidebarItemPermissions'
import { hasAtLeastPermissionLevel } from '../permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../permissions/types'
import { findUniqueSlug } from '../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../functions'
import { getSidebarItemsByParent } from './functions/getSidebarItemsByParent'
import { getSidebarItemById } from './functions/getSidebarItemById'
import { enhanceSidebarItem } from './functions/enhanceSidebarItem'
import { checkNameConflict, validateItemName } from './sharedValidation'
import type { ValidationResult } from './sharedValidation'
import type { SidebarItemId, SidebarItemTable } from './types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { FolderFromDb } from '../folders/types'
import type { AuthQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  EnhancedSidebarItem,
} from './types/types'

/**
 * Checks if a name is unique under a parent (case-insensitive).
 * Fetches all siblings and delegates to shared checkNameConflict.
 */
export async function checkUniqueNameUnderParent(
  ctx: AuthQueryCtx,
  {
    campaignId,
    parentId,
    name,
    excludeId,
  }: {
    campaignId: Id<'campaigns'>
    parentId: Id<'folders'> | null
    name: string
    excludeId?: SidebarItemId
  },
): Promise<ValidationResult> {
  await requireCampaignMembership(ctx, campaignId)
  const siblings = await getSidebarItemsByParent(ctx, { campaignId, parentId })
  return checkNameConflict(name, siblings, excludeId)
}

/**
 * Walks up the parent chain to check if setting newParentId would create a cycle.
 * Server version uses async ctx.db.get lookups.
 */
export async function validateNoCircularParent(
  ctx: AuthQueryCtx,
  {
    campaignId,
    itemId,
    newParentId,
  }: {
    campaignId: Id<'campaigns'>
    itemId: SidebarItemId
    newParentId: Id<'folders'> | null
  },
): Promise<ValidationResult> {
  await requireCampaignMembership(ctx, campaignId)
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
  ctx: AuthQueryCtx,
  {
    campaignId,
    parentId,
    name,
    excludeId,
  }: {
    campaignId: Id<'campaigns'>
    parentId: Id<'folders'> | null
    name: string
    excludeId?: SidebarItemId
  },
): Promise<{ siblings: Array<AnySidebarItem> }> {
  await requireCampaignMembership(ctx, campaignId)
  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, nameResult.error)
  }

  const siblings = await getSidebarItemsByParent(ctx, { campaignId, parentId })
  const uniqueResult = checkNameConflict(name, siblings, excludeId)
  if (!uniqueResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, uniqueResult.error)
  }

  return { siblings }
}

/**
 * Validates that a parent change won't create a circular reference
 * and that the user has full access to the target folder.
 * Throws an error if validation fails.
 */
export async function validateSidebarParentChange(
  ctx: AuthQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: AnySidebarItem
    newParentId: Id<'folders'> | null
  },
): Promise<void> {
  await requireCampaignMembership(ctx, item.campaignId)
  const result = await validateNoCircularParent(ctx, {
    campaignId: item.campaignId,
    itemId: item._id,
    newParentId,
  })
  if (!result.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, result.error)
  }
  if (newParentId) {
    const parentFromDb = await ctx.db.get(newParentId)
    if (parentFromDb && parentFromDb.location !== item.location) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Cannot move items into a folder in a different location',
      )
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
  ctx: AuthQueryCtx,
  {
    campaignId,
    parentId,
  }: { campaignId: Id<'campaigns'>; parentId: Id<'folders'> | null },
): Promise<void> {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
  if (parentId) {
    const parentItem = await getSidebarItemById(ctx, { id: parentId })
    if (!parentItem) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
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
  ctx: AuthQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: AnySidebarItem
    newParentId: Id<'folders'> | null
  },
): Promise<void> {
  await requireCampaignMembership(ctx, item.campaignId)
  await validateSidebarParentChange(ctx, { item, newParentId })

  await validateSidebarItemName(ctx, {
    campaignId: item.campaignId,
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
  ctx: AuthQueryCtx,
  {
    rawItem,
    requiredLevel,
  }: {
    rawItem: T | null
    requiredLevel: PermissionLevel
  },
): Promise<EnhancedSidebarItem<T> | null> {
  if (!rawItem) return null
  await requireCampaignMembership(ctx, rawItem.campaignId)
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
  ctx: AuthQueryCtx,
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
  ctx: AuthQueryCtx,
  {
    campaignId,
    slug,
    excludeId,
  }: {
    campaignId: Id<'campaigns'>
    slug: string
    excludeId?: SidebarItemId
  },
): Promise<boolean> {
  const queryTable = (table: SidebarItemTable) =>
    ctx.db
      .query(table)
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', campaignId).eq('slug', slug),
      ) // check deleted items as well since deleted items can be accessed by slug
      .unique()

  const [note, folder, map, file, canvas] = await Promise.all([
    queryTable('notes'),
    queryTable('folders'),
    queryTable('gameMaps'),
    queryTable('files'),
    queryTable('canvases'),
  ])

  const conflict = note ?? folder ?? map ?? file ?? canvas
  if (!conflict) return false
  return excludeId ? conflict._id !== excludeId : true
}

export async function findUniqueSidebarItemSlug(
  ctx: AuthQueryCtx,
  {
    campaignId,
    itemId,
    name,
  }: {
    campaignId: Id<'campaigns'>
    itemId?: SidebarItemId
    name: string
  },
): Promise<string> {
  await requireCampaignMembership(ctx, campaignId)
  return findUniqueSlug(name, (slug) =>
    checkSlugConflict(ctx, { campaignId, slug, excludeId: itemId }),
  )
}

/**
 * Validates a name change and generates a new unique slug.
 * Combines name validation (wiki-link + uniqueness) with slug generation.
 * Returns the new slug.
 */
export async function validateSidebarItemRename(
  ctx: AuthQueryCtx,
  {
    item,
    newName,
  }: {
    item: AnySidebarItem
    newName: string
  },
): Promise<string> {
  await requireCampaignMembership(ctx, item.campaignId)
  const trimmedName = newName.trim()
  const campaignId = item.campaignId
  await validateSidebarItemName(ctx, {
    campaignId,
    parentId: item.parentId,
    name: trimmedName,
    excludeId: item._id,
  })

  return findUniqueSidebarItemSlug(ctx, {
    campaignId,
    itemId: item._id,
    name: trimmedName,
  })
}

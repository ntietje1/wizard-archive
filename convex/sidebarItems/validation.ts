import {
  getSidebarItemById,
  getSidebarItemsByParent,
} from '../sidebarItems/sidebarItems'
import {
  getSidebarItemPermissionLevel,
  hasAtLeastPermissionLevel,
} from '../shares/itemShares'
import { PERMISSION_LEVEL } from '../shares/types'
import { findUniqueSidebarItemSlug } from '../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from './helpers'
import {
  checkNameConflict,
  validateWikiLinkCompatibleName,
} from './sharedValidation'
import type { PermissionLevel } from '../shares/types'
import type { FolderFromDb } from '../folders/types'
import type { SidebarItemId } from './baseTypes'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
  EnhancedSidebarItem,
} from './types'

export type { ValidationResult } from './sharedValidation'
export { validateWikiLinkCompatibleName } from './sharedValidation'

/**
 * Checks if a name is unique under a parent (case-insensitive).
 * Fetches all siblings and delegates to shared checkNameConflict.
 */
export async function checkUniqueNameUnderParent(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  name: string | undefined,
  excludeId?: SidebarItemId,
): Promise<{ valid: boolean; error?: string }> {
  if (!name || name.trim() === '') {
    return { valid: true }
  }

  const siblings = await getSidebarItemsByParent(ctx, campaignId, parentId)
  return checkNameConflict(name, siblings, excludeId)
}

/**
 * Walks up the parent chain to check if setting newParentId would create a cycle.
 * Server version uses async ctx.db.get lookups.
 */
export async function validateNoCircularParent(
  ctx: CampaignQueryCtx,
  itemId: SidebarItemId,
  newParentId: Id<'folders'> | undefined,
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
  let currentId: Id<'folders'> | undefined = newParentId

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
    currentId = current?.parentId
  }

  return { valid: true }
}

export interface ValidateSidebarItemNameOptions {
  ctx: CampaignQueryCtx
  campaignId: Id<'campaigns'>
  parentId: Id<'folders'> | undefined
  name: string | undefined
  excludeId?: SidebarItemId
}

/**
 * Validates a sidebar item name (wiki-link + uniqueness).
 * Throws an error if validation fails.
 */
export async function validateSidebarItemName(
  options: ValidateSidebarItemNameOptions,
): Promise<void> {
  const { ctx, campaignId, parentId, name, excludeId } = options

  const wikiLinkResult = validateWikiLinkCompatibleName(name)
  if (!wikiLinkResult.valid) {
    throw new Error(wikiLinkResult.error)
  }

  const uniqueResult = await checkUniqueNameUnderParent(
    ctx,
    campaignId,
    parentId,
    name,
    excludeId,
  )
  if (!uniqueResult.valid) {
    throw new Error(uniqueResult.error)
  }
}

export interface ValidateParentChangeOptions {
  ctx: CampaignQueryCtx
  item: AnySidebarItem
  newParentId: Id<'folders'> | undefined
}

/**
 * Validates that a parent change won't create a circular reference
 * and that the user has full access to the target folder.
 * Throws an error if validation fails.
 */
export async function validateParentChange(
  options: ValidateParentChangeOptions,
): Promise<void> {
  const { ctx, item, newParentId } = options

  const result = await validateNoCircularParent(ctx, item._id, newParentId)
  if (!result.valid) {
    throw new Error(result.error)
  }
  if (newParentId) {
    const parentFromDb = await ctx.db.get(newParentId)
    await requireItemAccess(
      ctx,
      item.campaignId,
      parentFromDb,
      PERMISSION_LEVEL.FULL_ACCESS,
    )
  }
}

/**
 * Validates that the parent exists and the user has full access,
 * or that the user is a DM for root-level creation.
 * Throws if validation fails.
 */
export async function validateCreateParent(
  ctx: CampaignQueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
): Promise<void> {
  if (parentId) {
    const parentItem = await getSidebarItemById(ctx, campaignId, parentId)
    if (!parentItem) {
      throw new Error('Parent not found')
    }
    const level = await getSidebarItemPermissionLevel(ctx, parentItem)
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
export async function validateMove(
  ctx: CampaignQueryCtx,
  item: AnySidebarItem,
  newParentId: Id<'folders'> | undefined,
): Promise<void> {
  await validateParentChange({ ctx, item, newParentId })

  await validateSidebarItemName({
    ctx,
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
  ctx: CampaignQueryCtx,
  rawItem: T | null,
  requiredLevel: PermissionLevel,
): Promise<EnhancedSidebarItem<T> | null> {
  if (!rawItem) return null
  const item = await enhanceSidebarItem(ctx, rawItem)
  const level = await getSidebarItemPermissionLevel(ctx, item)
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
  campaignId: Id<'campaigns'>,
  rawItem: T | null,
  requiredLevel: PermissionLevel,
): Promise<EnhancedSidebarItem<T>> {
  if (!rawItem || rawItem.campaignId !== campaignId) {
    throw new Error('Item not found')
  }
  const item = await checkItemAccess(ctx, rawItem, requiredLevel)
  if (!item) {
    throw new Error('You do not have sufficient permission for this item')
  }
  return item
}

/**
 * Validates a name change and generates a new unique slug.
 * Combines name validation (wiki-link + uniqueness) with slug generation.
 * Returns the new slug.
 */
export async function validateRename(
  ctx: CampaignMutationCtx,
  campaignId: Id<'campaigns'>,
  item: AnySidebarItem,
  newName: string,
): Promise<string> {
  await validateSidebarItemName({
    ctx,
    campaignId,
    parentId: item.parentId,
    name: newName,
    excludeId: item._id,
  })

  return findUniqueSidebarItemSlug(
    ctx,
    campaignId,
    item.type,
    newName,
    item._id,
  )
}

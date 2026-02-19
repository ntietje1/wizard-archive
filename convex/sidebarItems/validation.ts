import { getSidebarItemsByParent } from '../sidebarItems/sidebarItems'
import { hasFullAccessPermission } from '../shares/itemShares'
import { enhanceSidebarItem } from './helpers'
import {
  checkNameConflict,
  validateWikiLinkCompatibleName,
} from './sharedValidation'
import type { SidebarItemId } from './baseTypes'
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'
import type { AnySidebarItem } from './types'

export type { ValidationResult } from './sharedValidation'
export { validateWikiLinkCompatibleName } from './sharedValidation'

// TODO: share as much of this as possible with the frontend validation
/**
 * Checks if a name is unique under a parent (case-insensitive).
 * Fetches all siblings and delegates to shared checkNameConflict.
 */
export async function checkUniqueNameUnderParent(
  ctx: Ctx,
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
  ctx: Ctx,
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

    const current = await ctx.db.get(currentId)
    currentId = current?.parentId as Id<'folders'> | undefined
  }

  return { valid: true }
}

export interface ValidateSidebarItemNameOptions {
  ctx: Ctx
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
  ctx: Ctx
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
    if (!parentFromDb) {
      throw new Error('Target folder not found')
    }
    const parentItem = await enhanceSidebarItem(ctx, parentFromDb)
    const hasAccess = await hasFullAccessPermission(ctx, parentItem)
    if (!hasAccess) {
      throw new Error('You do not have permission to move items here')
    }
  }
}

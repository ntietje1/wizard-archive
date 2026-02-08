import { getSidebarItemsByParentAndName } from '../sidebarItems/sidebarItems'
import { hasFullAccessPermission } from '../shares/itemShares'
import type { SidebarItemId } from './baseTypes'
import type { Ctx } from '../common/types'
import type { Id } from '../_generated/dataModel'
import type { AnySidebarItem } from './types'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that a name is compatible with wiki-link syntax.
 * Names cannot contain [ ] # | as these are wiki-link delimiters/modifiers.
 */
export function validateWikiLinkCompatibleName(
  name: string | undefined,
): ValidationResult {
  if (!name) return { valid: true }

  if (name.includes('[')) {
    return {
      valid: false,
      error: 'Name cannot contain "[" as it conflicts with wiki-link syntax',
    }
  }
  if (name.includes(']')) {
    return {
      valid: false,
      error: 'Name cannot contain "]" as it conflicts with wiki-link syntax',
    }
  }
  if (name.includes('#')) {
    return {
      valid: false,
      error:
        'Name cannot contain "#" as it conflicts with wiki-link heading syntax',
    }
  }
  if (name.includes('|')) {
    return {
      valid: false,
      error:
        'Name cannot contain "|" as it conflicts with wiki-link display name syntax',
    }
  }
  return { valid: true }
}

/**
 * Checks if a name is unique under a parent.
 */
export async function checkUniqueNameUnderParent(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  name: string | undefined,
  excludeId?: SidebarItemId,
): Promise<ValidationResult> {
  if (!name || name.trim() === '') {
    return { valid: true }
  }

  const items = await getSidebarItemsByParentAndName(
    ctx,
    campaignId,
    parentId,
    name,
  )

  const hasConflict = items.some((item) => item._id !== excludeId)

  if (hasConflict) {
    return {
      valid: false,
      error: 'An item with this name already exists here',
    }
  }
  return { valid: true }
}

/**
 * Walks up the parent chain to check if setting newParentId would create a cycle.
 */
export async function validateNoCircularParent(
  ctx: Ctx,
  itemId: SidebarItemId,
  newParentId: SidebarItemId | undefined,
): Promise<ValidationResult> {
  // Moving to root is always valid
  if (!newParentId) {
    return { valid: true }
  }

  // Can't set parent to self
  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  // Walk up the parent chain from newParentId
  const seen = new Set<string>()
  let currentId: SidebarItemId | undefined = newParentId

  while (currentId) {
    if (seen.has(currentId)) {
      // Cycle in existing data (shouldn't happen)
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
    currentId = current?.parentId as SidebarItemId | undefined
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

  // Check wiki link compatibility
  const wikiLinkResult = validateWikiLinkCompatibleName(name)
  if (!wikiLinkResult.valid) {
    throw new Error(wikiLinkResult.error)
  }

  // Check name uniqueness
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
  newParentId: SidebarItemId | undefined
}

/**
 * Validates that a parent change won't create a circular reference.
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
  const hasAccess = await hasFullAccessPermission(ctx, item)
  if (!hasAccess) {
    throw new Error('You do not have permission to move items here')
  }
}

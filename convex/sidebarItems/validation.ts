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
import type { SidebarItemId } from './types/baseTypes'
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
    parentId,
    name,
    excludeId,
    campaignId,
  }: {
    parentId: Id<'folders'> | null
    name: string
    excludeId?: SidebarItemId
    campaignId: Id<'campaigns'>
  },
): Promise<{ valid: boolean; error?: string }> {
  await requireCampaignMembership(ctx, campaignId)
  const siblings = await getSidebarItemsByParent(ctx, { parentId, campaignId })
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
): Promise<{ valid: boolean; error?: string }> {
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
    parentId,
    name,
    excludeId,
    campaignId,
  }: {
    parentId: Id<'folders'> | null
    name: string
    excludeId?: SidebarItemId
    campaignId: Id<'campaigns'>
  },
): Promise<{ siblings: Array<AnySidebarItem> }> {
  await requireCampaignMembership(ctx, campaignId)
  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    throw new Error(nameResult.error)
  }

  const siblings = await getSidebarItemsByParent(ctx, { parentId, campaignId })
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
    throw new Error(result.error)
  }
  if (newParentId) {
    const parentFromDb = await ctx.db.get(newParentId)
    if (parentFromDb && parentFromDb.location !== item.location) {
      throw new Error('Cannot move items into a folder in a different location')
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
    parentId,
    campaignId,
  }: { parentId: Id<'folders'> | null; campaignId: Id<'campaigns'> },
): Promise<void> {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
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
    if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
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
    parentId: newParentId,
    name: item.name,
    excludeId: item._id,
    campaignId: item.campaignId,
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
    throw new Error('Item not found')
  }
  const item = await checkItemAccess(ctx, { rawItem, requiredLevel })
  if (!item) {
    throw new Error('You do not have sufficient permission for this item')
  }
  return item
}

async function checkSlugConflict(
  ctx: AuthQueryCtx,
  {
    slug,
    excludeId,
    campaignId,
  }: {
    slug: string
    excludeId?: SidebarItemId
    campaignId: Id<'campaigns'>
  },
): Promise<boolean> {
  const queryTable = (table: 'notes' | 'folders' | 'gameMaps' | 'files') =>
    ctx.db
      .query(table)
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', campaignId).eq('slug', slug),
      )
      .unique()

  const [note, folder, map, file] = await Promise.all([
    queryTable('notes'),
    queryTable('folders'),
    queryTable('gameMaps'),
    queryTable('files'),
  ])

  const conflict = note ?? folder ?? map ?? file
  if (!conflict) return false
  return excludeId ? conflict._id !== excludeId : true
}

export async function findUniqueSidebarItemSlug(
  ctx: AuthQueryCtx,
  {
    name,
    itemId,
    campaignId,
  }: {
    name: string
    itemId: SidebarItemId
    campaignId: Id<'campaigns'>
  },
): Promise<string> {
  await requireCampaignMembership(ctx, campaignId)
  return findUniqueSlug(name, (slug) =>
    checkSlugConflict(ctx, { slug, excludeId: itemId, campaignId }),
  )
}

export async function findNewSidebarItemSlug(
  ctx: AuthQueryCtx,
  {
    name,
    campaignId,
  }: {
    name: string
    campaignId: Id<'campaigns'>
  },
): Promise<string> {
  await requireCampaignMembership(ctx, campaignId)
  return findUniqueSlug(name, (slug) =>
    checkSlugConflict(ctx, { slug, campaignId }),
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
    parentId: item.parentId,
    name: trimmedName,
    excludeId: item._id,
    campaignId,
  })

  return findUniqueSidebarItemSlug(ctx, {
    name: trimmedName,
    itemId: item._id,
    campaignId,
  })
}

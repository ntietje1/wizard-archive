import { findUniqueSlug } from '../../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { getSidebarItem } from '../functions/getSidebarItem'
import { getSidebarItemsByParent } from '../functions/getSidebarItemsByParent'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { AnySidebarItem } from '../types/types'
import { requireItemAccess } from './access'
import { assertSidebarItemName, checkNameConflict } from './name'
import { validateNoCircularParentAsync } from './parent'
import { assertSidebarItemSlug, validateSidebarItemSlug } from './slug'
import type { SidebarItemName, ValidationResult } from './name'
import type { SidebarItemSlug } from './slug'

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
): Promise<void> {
  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  const uniqueResult = checkNameConflict(name, siblings, excludeId)
  if (!uniqueResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, uniqueResult.error)
  }
}

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
  const result = await validateNoCircularParentAsync(item._id, newParentId, (currentId) =>
    ctx.db.get('sidebarItems', currentId),
  )
  if (!result.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, result.error)
  }

  if (newParentId) {
    const parentFromDb = await getSidebarItem(ctx, newParentId)
    if (!parentFromDb) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    if (parentFromDb.type !== SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Parent must be a folder')
    }
    if (parentFromDb.location !== item.location) {
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

export async function validateSidebarCreateParent(
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'sidebarItems'> | null },
): Promise<void> {
  const { membership } = ctx
  if (parentId) {
    const parentItem = await getSidebarItem(ctx, parentId)
    if (!parentItem) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    if (parentItem.type !== SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Parent must be a folder')
    }
    await requireItemAccess(ctx, {
      rawItem: parentItem,
      requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
  } else if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can create items at the root level')
  }
}

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
    name: string
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
  } catch (error) {
    console.error('Failed to generate unique slug:', error)
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
): Promise<{ name: SidebarItemName; slug: SidebarItemSlug }> {
  await validateSidebarCreateParent(ctx, { parentId })
  await ensureSidebarItemNameAvailable(ctx, { parentId, name })

  const slug = await findUniqueSidebarItemSlug(ctx, { name })

  return { name, slug }
}

export async function prepareSidebarItemRename(
  ctx: CampaignQueryCtx,
  {
    item,
    newName,
  }: {
    item: AnySidebarItem
    newName: SidebarItemName
  },
): Promise<{ name: SidebarItemName; slug: SidebarItemSlug } | null> {
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

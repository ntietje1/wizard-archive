import { findUniqueSlug } from '../../common/slug'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { getSidebarItem } from '../functions/getSidebarItem'
import { getActiveSidebarItemRowsByParent } from '../functions/getSidebarItemsByParent'
import { deduplicateName } from '../functions/defaultItemName'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { isActiveSidebarItem } from '../types/status'
import { assertSidebarOperationAllowed, evaluateMoveToParent } from '../filesystem/capabilities'
import type { OperationSidebarItem } from '../filesystem/capabilities'
import type { AnySidebarItem } from '../types/types'
import { checkItemAccess, requireItemAccess } from './access'
import { assertSidebarItemName, checkNameConflict } from './name'
import { validateNoCircularParentAsync } from './parent'
import {
  SIDEBAR_ITEM_SLUG_MAX_LENGTH,
  assertSidebarItemSlug,
  validateSidebarItemSlug,
} from './slug'
import type { SidebarItemName, ValidationResult } from './name'
import type { SidebarItemSlug } from './slug'

const MAX_SIDEBAR_PARENT_DEPTH = 100
type NamedOperationSidebarItem = OperationSidebarItem & Pick<AnySidebarItem, 'name'>

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
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  return checkNameConflict(name, siblings, excludeId)
}

export async function ensureSidebarItemNameAvailable(
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
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  const uniqueResult = checkNameConflict(name, siblings, excludeId)
  if (!uniqueResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, uniqueResult.error)
  }
}

export async function validateNoCircularSidebarParentChange(
  ctx: CampaignQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: OperationSidebarItem
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  const result = await validateNoCircularParentAsync(item._id, newParentId, (currentId) =>
    ctx.db.get('sidebarItems', currentId).then((parent) => {
      if (!parent || parent.campaignId !== ctx.campaign._id) return null
      return parent
    }),
  )
  if (!result.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, result.error)
  }
}

export async function validateSidebarParentChange(
  ctx: CampaignQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: OperationSidebarItem
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  await validateNoCircularSidebarParentChange(ctx, { item, newParentId })
  let parent: AnySidebarItem | null = null
  if (newParentId) {
    const parentFromDb = await getSidebarItem(ctx, newParentId)
    if (!parentFromDb) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    // checkItemAccess with PERMISSION_LEVEL.NONE intentionally normalizes parentFromDb for evaluateMoveToParent.
    parent = await checkItemAccess(ctx, {
      rawItem: parentFromDb,
      requiredLevel: PERMISSION_LEVEL.NONE,
    })
  }
  const ancestorIds: Array<Id<'sidebarItems'>> = []
  let currentParentId = parent?.parentId ?? null
  const visitedParentIds = new Set<Id<'sidebarItems'>>()
  while (currentParentId) {
    if (visitedParentIds.has(currentParentId)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Existing sidebar parent cycle detected')
    }
    if (ancestorIds.length >= MAX_SIDEBAR_PARENT_DEPTH) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Sidebar parent depth exceeds maximum allowed depth',
      )
    }
    visitedParentIds.add(currentParentId)
    ancestorIds.push(currentParentId)
    const currentParent = await ctx.db.get('sidebarItems', currentParentId)
    if (currentParent && currentParent.campaignId !== ctx.campaign._id) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Existing sidebar parent is invalid')
    }
    currentParentId = currentParent?.parentId ?? null
  }

  assertSidebarOperationAllowed(
    evaluateMoveToParent({ role: ctx.membership.role }, item, {
      parentId: newParentId,
      parent,
      ancestorIds,
    }),
  )
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
    if (!isActiveSidebarItem(parentItem)) {
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
    name,
  }: {
    item: NamedOperationSidebarItem
    newParentId: Id<'sidebarItems'> | null
    name?: SidebarItemName
  },
): Promise<void> {
  await validateSidebarParentChange(ctx, { item, newParentId })

  await ensureSidebarItemNameAvailable(ctx, {
    parentId: newParentId,
    name: name ?? assertSidebarItemName(item.name),
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
    .first()
  if (!excludeId) {
    return conflict !== null
  }
  return conflict !== null && conflict._id !== excludeId
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
  const candidateSlug = await findUniqueSlug(
    name,
    (candidate) =>
      checkSlugConflict(ctx, {
        campaignId: ctx.campaign._id,
        slug: candidate,
        excludeId: itemId,
      }),
    {
      maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
      isValidCandidate: (candidate) => validateSidebarItemSlug(candidate) === null,
    },
  )
  return assertSidebarItemSlug(candidateSlug)
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
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  const uniqueName = assertSidebarItemName(
    deduplicateName(
      name,
      siblings.map((sibling) => sibling.name),
    ),
  )

  const slug = await findUniqueSidebarItemSlug(ctx, { name: uniqueName })

  return { name: uniqueName, slug }
}

export async function prepareSidebarItemRename(
  ctx: CampaignQueryCtx,
  {
    item,
    newName,
  }: {
    item: NamedOperationSidebarItem
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

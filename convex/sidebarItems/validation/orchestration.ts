import { deduplicateSlug, slugify } from '../../../shared/slugs'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import {
  PERMISSION_OPERATION,
  getPermissionRequirementForOperation,
} from '../../../shared/permissions/requirements'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { getSidebarItem } from '../functions/getSidebarItem'
import { getActiveSidebarItemRowsByParent } from '../functions/getSidebarItemsByParent'
import {
  deduplicateResourceName,
  assertResourceName,
  checkResourceNameConflict,
  validateNoCircularResourceParentAsync,
  RESOURCE_SLUG_MAX_LENGTH,
  assertResourceSlug,
} from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  AnyResource,
  ResourceName,
  ResourceValidationResult,
  ResourceSlug,
} from '@wizard-archive/editor/resources/resource-contract'
import { isActiveSidebarItem } from '../types/status'
import { evaluateMoveToParent } from '@wizard-archive/editor/resources/operation-capabilities'
import type { OperationResourceItem } from '@wizard-archive/editor/resources/operation-capabilities'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../filesystem/capabilities'
import { checkItemAccess, requireItemAccess } from './access'
const MAX_SIDEBAR_PARENT_DEPTH = 100
type NamedOperationResourceItem = OperationResourceItem & Pick<AnyResource, 'name'>

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
): Promise<ResourceValidationResult> {
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  return checkResourceNameConflict(
    name,
    siblings.map((sibling) => ({ id: sibling._id, name: sibling.name })),
    excludeId,
  )
}

export async function ensureSidebarItemNameAvailable(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
    excludeId,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: ResourceName
    excludeId?: Id<'sidebarItems'>
  },
): Promise<void> {
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  const uniqueResult = checkResourceNameConflict(
    name,
    siblings.map((sibling) => ({ id: sibling._id, name: sibling.name })),
    excludeId,
  )
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
    item: OperationResourceItem
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  const result = await validateNoCircularResourceParentAsync(item.id, newParentId, (currentId) =>
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
    item: OperationResourceItem
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  await validateNoCircularSidebarParentChange(ctx, { item, newParentId })
  let parent: AnyResource | null = null
  if (newParentId) {
    const parentRow = await getSidebarItem(ctx, newParentId)
    if (!parentRow) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    // checkItemAccess with PERMISSION_LEVEL.NONE intentionally normalizes parentRow for evaluateMoveToParent.
    parent = await checkItemAccess(ctx, {
      rawItem: parentRow,
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
    evaluateMoveToParent(operationActorFromRole(ctx.membership.role), item, {
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
    if (parentItem.type !== RESOURCE_TYPES.folders) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Parent must be a folder')
    }
    await requireItemAccess(ctx, {
      rawItem: parentItem,
      requiredLevel: getPermissionRequirementForOperation(PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM),
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
    item: NamedOperationResourceItem
    newParentId: Id<'sidebarItems'> | null
    name?: ResourceName
  },
): Promise<void> {
  await validateSidebarParentChange(ctx, { item, newParentId })

  await ensureSidebarItemNameAvailable(ctx, {
    parentId: newParentId,
    name: name ?? assertResourceName(item.name),
    excludeId: item.id,
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
): Promise<ResourceSlug> {
  const baseSlug = slugify(name, {
    fallback: 'item',
    maxLength: RESOURCE_SLUG_MAX_LENGTH,
  })
  const conflicts = new Set<string>()

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidateSlug = deduplicateSlug(baseSlug, conflicts, {
      label: 'Slug',
      maxLength: RESOURCE_SLUG_MAX_LENGTH,
    })
    const conflict = await checkSlugConflict(ctx, {
      campaignId: ctx.campaign._id,
      slug: candidateSlug,
      excludeId: itemId,
    })
    if (!conflict) {
      return assertResourceSlug(candidateSlug)
    }
    conflicts.add(candidateSlug)
  }

  throwClientError(ERROR_CODE.VALIDATION_FAILED, `Failed to find unique slug for "${name}"`)
}

export async function prepareSidebarItemCreate(
  ctx: CampaignQueryCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: ResourceName
  },
): Promise<{ name: ResourceName; slug: ResourceSlug }> {
  await validateSidebarCreateParent(ctx, { parentId })
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  const uniqueName = assertResourceName(
    deduplicateResourceName(
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
    item: NamedOperationResourceItem
    newName: ResourceName
  },
): Promise<{ name: ResourceName; slug: ResourceSlug } | null> {
  if (newName === item.name) {
    return null
  }

  await ensureSidebarItemNameAvailable(ctx, {
    parentId: item.parentId,
    name: newName,
    excludeId: item.id,
  })

  const slug = await findUniqueSidebarItemSlug(ctx, {
    itemId: item.id,
    name: newName,
  })

  return { name: newName, slug }
}

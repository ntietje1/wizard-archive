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
import { validateNoCircularResourceParentAsync } from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { AnyResource } from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { isActiveSidebarItem } from '../types/status'
import { evaluateMoveToParent } from '@wizard-archive/editor/resources/operation-capabilities'
import type { OperationResourceItem } from '@wizard-archive/editor/resources/operation-capabilities'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../filesystem/capabilities'
import { checkSidebarItemRowAccess } from '../filesystem/access'
import type { AccessibleSidebarItemRow } from '../filesystem/access'
import { requireItemAccess } from './access'
const MAX_SIDEBAR_PARENT_DEPTH = 100
type NamedOperationResourceItem<TId extends string> = OperationResourceItem<TId> &
  Pick<AnyResource, 'name'>

export async function validateNoCircularSidebarParentChange(
  ctx: CampaignQueryCtx,
  {
    item,
    newParentId,
  }: {
    item: OperationResourceItem<Id<'sidebarItems'>>
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
    item: OperationResourceItem<Id<'sidebarItems'>>
    newParentId: Id<'sidebarItems'> | null
  },
): Promise<void> {
  await validateNoCircularSidebarParentChange(ctx, { item, newParentId })
  let parent: AccessibleSidebarItemRow | null = null
  if (newParentId) {
    const parentRow = await ctx.db.get('sidebarItems', newParentId)
    if (!parentRow) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    parent = await checkSidebarItemRowAccess(ctx, {
      rawItem: parentRow,
      requiredLevel: PERMISSION_LEVEL.NONE,
    })
  }
  const ancestorIds: Array<Id<'sidebarItems'>> = []
  let currentParentId = newParentId ? (parent?.parentId ?? null) : null
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
  }: {
    item: NamedOperationResourceItem<Id<'sidebarItems'>>
    newParentId: Id<'sidebarItems'> | null
    name?: ResourceTitle
  },
): Promise<void> {
  await validateSidebarParentChange(ctx, { item, newParentId })
}

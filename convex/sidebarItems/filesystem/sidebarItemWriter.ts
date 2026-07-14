import { validateSidebarCreateParent } from '../validation/orchestration'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  ResourceColor,
  ResourceIconName,
  ResourceKind,
} from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { normalizeLegacyResourcePathSegment } from '../resourcePathSegment'

import { assertSidebarItemLifecycleConsistency } from '../types/status'
import { findSidebarItemRow } from '../functions/sidebarItemIdentity'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
export type InsertFilesystemSidebarItemArgs = {
  resourceId: ResourceId
  type: ResourceKind
  name: ResourceTitle
  parentId: Id<'sidebarItems'> | null
  iconName?: ResourceIconName
  color?: ResourceColor
  previewStorageId?: Doc<'sidebarItems'>['previewStorageId']
  previewUpdatedAt?: Doc<'sidebarItems'>['previewUpdatedAt']
}

export async function insertFilesystemSidebarItem(
  ctx: CampaignMutationCtx,
  {
    type,
    resourceId,
    name,
    parentId,
    iconName,
    color,
    previewStorageId,
    previewUpdatedAt,
  }: InsertFilesystemSidebarItemArgs,
): Promise<{ itemId: Id<'sidebarItems'>; resourceId: ResourceId }> {
  if (await findSidebarItemRow(ctx, resourceId)) {
    throwClientError(ERROR_CODE.CONFLICT, 'Resource id already exists')
  }
  await validateSidebarCreateParent(ctx, { parentId })

  const row = {
    resourceUuid: resourceId,
    campaignId: ctx.campaign._id,
    name,
    normalizedName: normalizeLegacyResourcePathSegment(name),
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    type,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewStorageId: previewStorageId ?? null,
    previewUpdatedAt: previewUpdatedAt ?? null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.membership.campaignMemberUuid,
  }
  assertSidebarItemLifecycleConsistency(row)
  const itemId = await ctx.db.insert('sidebarItems', row)

  return { itemId, resourceId }
}

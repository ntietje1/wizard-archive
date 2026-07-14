import { prepareSidebarItemCreate } from '../validation/orchestration'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  ResourceColor,
  ResourceSlug,
  ResourceIconName,
  ResourceKind,
} from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { normalizeLegacyResourcePathSegment } from '../resourcePathSegment'

import { assertSidebarItemLifecycleConsistency } from '../types/status'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
export type InsertFilesystemSidebarItemArgs = {
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
    name,
    parentId,
    iconName,
    color,
    previewStorageId,
    previewUpdatedAt,
  }: InsertFilesystemSidebarItemArgs,
): Promise<{ itemId: Id<'sidebarItems'>; resourceId: ResourceId; slug: ResourceSlug }> {
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId,
    name,
  })

  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const row = {
    resourceUuid: resourceId,
    campaignId: ctx.campaign._id,
    name: prepared.name,
    normalizedName: normalizeLegacyResourcePathSegment(prepared.name),
    slug: prepared.slug,
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
    createdBy: ctx.membership.userId,
  }
  assertSidebarItemLifecycleConsistency(row)
  const itemId = await ctx.db.insert('sidebarItems', row)

  return { itemId, resourceId, slug: prepared.slug }
}

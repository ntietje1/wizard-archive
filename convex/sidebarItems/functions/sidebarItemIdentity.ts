import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'

type SidebarItemIdentityCtx = Pick<QueryCtx, 'db'>

export function sidebarItemResourceId(item: Doc<'sidebarItems'>): ResourceId {
  return assertDomainId(DOMAIN_ID_KIND.resource, item.resourceUuid)
}

export async function findSidebarItemRow(ctx: SidebarItemIdentityCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

export async function requireSidebarItemRow(ctx: SidebarItemIdentityCtx, resourceId: ResourceId) {
  const row = await findSidebarItemRow(ctx, resourceId)
  if (!row) throwClientError(ERROR_CODE.NOT_FOUND, 'Resource not found')
  return row
}

export async function requireSidebarItemRows(
  ctx: SidebarItemIdentityCtx,
  resourceIds: ReadonlyArray<ResourceId>,
) {
  return await Promise.all(resourceIds.map((resourceId) => requireSidebarItemRow(ctx, resourceId)))
}

export async function sidebarItemParentResourceId(
  ctx: SidebarItemIdentityCtx,
  parentId: Id<'sidebarItems'> | null,
): Promise<ResourceId | null> {
  if (parentId === null) return null
  const parent = await ctx.db.get('sidebarItems', parentId)
  if (!parent) throw new Error('Resource parent is missing')
  return sidebarItemResourceId(parent)
}

import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { enhanceSidebarItem, enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import { canAccessResourceAndAncestors } from './resourceAccessPolicy'
import { isTrashedSidebarItem, isUndoHiddenSidebarItem } from '../types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  AnyResourceWithContent,
  ResourceSlug,
} from '@wizard-archive/editor/resources/resource-contract'
import { findSidebarItemRow } from './sidebarItemIdentity'

export type SidebarItemAccessLookup =
  | { kind: 'id'; id: ResourceId }
  | { kind: 'slug'; slug: ResourceSlug }

export type SidebarItemAccessResolution =
  | { status: 'not_found' }
  | { status: 'not_shared' }
  | { status: 'trashed' }
  | { status: 'available'; item: AnyResourceWithContent }

export async function resolveSidebarItemAccess(
  ctx: CampaignQueryCtx,
  lookup: SidebarItemAccessLookup,
): Promise<SidebarItemAccessResolution> {
  const rawItem = await getSidebarItemByAccessLookup(ctx, lookup)
  if (!rawItem) return { status: 'not_found' }

  if (!(await canAccessResourceAndAncestors(ctx, rawItem, PERMISSION_LEVEL.VIEW))) {
    return { status: 'not_shared' }
  }
  if (isTrashedSidebarItem(rawItem)) return { status: 'trashed' }

  const item = await getSidebarItem(ctx, rawItem._id)
  if (!item) return { status: 'not_found' }
  const enhanced = await enhanceSidebarItem(ctx, { item })

  return {
    status: 'available',
    item: await enhanceSidebarItemWithContent(ctx, { item: enhanced }),
  }
}

async function getSidebarItemByAccessLookup(
  ctx: CampaignQueryCtx,
  lookup: SidebarItemAccessLookup,
): Promise<Doc<'sidebarItems'> | null> {
  const raw =
    lookup.kind === 'id'
      ? await findSidebarItemRow(ctx, lookup.id)
      : await ctx.db
          .query('sidebarItems')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', ctx.campaign._id).eq('slug', lookup.slug),
          )
          .unique()

  if (!raw || raw.campaignId !== ctx.campaign._id || isUndoHiddenSidebarItem(raw)) return null
  return raw
}

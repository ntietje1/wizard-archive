import { asyncMap } from 'convex-helpers'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItemFromRaw } from './getSidebarItem'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { AnyResource, ResourceShare } from '@wizard-archive/editor/resources/resource-contract'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { AccessibleResourceRow } from './resourceAccessPolicy'
import {
  loadSidebarItemShareIdentityProjection,
  projectSidebarItemShare,
} from '../../sidebarShares/functions/projectSidebarItemShare'

export async function enhanceSidebarItemRows(
  ctx: CampaignQueryCtx,
  accessibleRows: Array<AccessibleResourceRow>,
): Promise<Array<AnyResource>> {
  if (accessibleRows.length === 0) return []
  const itemIds = new Set(accessibleRows.map(({ rawItem }) => rawItem._id))
  const isDm = ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM
  const [campaignShares, memberBookmarks, projection] = await Promise.all([
    isDm
      ? ctx.db
          .query('sidebarItemShares')
          .withIndex('by_campaign_member', (q) => q.eq('campaignId', ctx.campaign._id))
          .collect()
      : [],
    ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q.eq('campaignId', ctx.campaign._id).eq('campaignMemberId', ctx.membership._id),
      )
      .collect(),
    isDm ? loadSidebarItemShareIdentityProjection(ctx) : null,
  ])
  const sharesByItemId = new Map<Id<'sidebarItems'>, Array<ResourceShare>>()
  for (const share of campaignShares) {
    if (!itemIds.has(share.sidebarItemId)) continue
    const itemShares = sharesByItemId.get(share.sidebarItemId) ?? []
    if (!projection) throw new Error('Resource share projection is unavailable')
    itemShares.push(projectSidebarItemShare(share, projection.identities))
    sharesByItemId.set(share.sidebarItemId, itemShares)
  }
  const bookmarkedItemIds = new Set(
    memberBookmarks.flatMap((bookmark) =>
      itemIds.has(bookmark.sidebarItemId) ? [bookmark.sidebarItemId] : [],
    ),
  )

  return (
    await asyncMap(accessibleRows, async ({ rawItem, myPermissionLevel }) => {
      const item = await getSidebarItemFromRaw(ctx, rawItem)
      return item
        ? enhanceSidebarItem(ctx, {
            item,
            enhancement: {
              shares: sharesByItemId.get(rawItem._id) ?? [],
              isBookmarked: bookmarkedItemIds.has(rawItem._id),
              myPermissionLevel,
            },
          })
        : null
    })
  ).filter((item): item is NonNullable<typeof item> => item !== null)
}

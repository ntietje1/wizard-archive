import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemShare } from '../types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export type SharesMap = Map<SidebarItemId, Map<Id<'campaignMembers'>, SidebarItemShare>>

function buildSharesMap(shares: Array<SidebarItemShare>): SharesMap {
  const map: SharesMap = new Map()
  for (const share of shares) {
    let byMember = map.get(share.sidebarItemId)
    if (!byMember) {
      byMember = new Map()
      map.set(share.sidebarItemId, byMember)
    }
    byMember.set(share.campaignMemberId, share)
  }
  return map
}

/**
 * Load shares scoped to a single member.
 * Each item has at most one share entry.
 */
export async function getMemberShares(
  ctx: AuthQueryCtx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<SharesMap> {
  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()
  return buildSharesMap(shares)
}

/**
 * Load all shares for a campaign (all members).
 * Used by DMs who need full share data.
 */
export async function getAllCampaignShares(
  ctx: AuthQueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<SharesMap> {
  const allShares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) => q.eq('campaignId', campaignId))
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()
  return buildSharesMap(allShares)
}

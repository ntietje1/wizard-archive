import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { BlockShare, SidebarItemShare } from './types'

export async function getSharesForSession(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sessionId: Id<'sessions'>,
): Promise<{
  sidebarItemShares: Array<SidebarItemShare>
  blockShares: Array<BlockShare>
}> {
  const [sidebarItemShares, blockShares] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_session', (q) =>
        q.eq('campaignId', campaignId).eq('sessionId', sessionId),
      )
      .collect(),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_session', (q) =>
        q.eq('campaignId', campaignId).eq('sessionId', sessionId),
      )
      .collect(),
  ])

  return { sidebarItemShares, blockShares }
}

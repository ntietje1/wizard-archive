import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { enhanceSidebarItemRows } from './enhanceSidebarItemRows'
import { resolveResourceRowsByAccess } from './resourceAccessPolicy'
import type { AnyResource } from '@wizard-archive/editor/resources/resource-contract'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export type CampaignSidebarItems = {
  active: Array<AnyResource>
  trash: Array<AnyResource>
}

async function collectRawItemsByStatus(
  ctx: CampaignQueryCtx,
  status: typeof RESOURCE_STATUS.active | typeof RESOURCE_STATUS.trashed,
): Promise<Array<Doc<'sidebarItems'>>> {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('status', status),
    )
    .collect()
}

export async function fetchCampaignSidebarItems(
  ctx: CampaignQueryCtx,
): Promise<CampaignSidebarItems> {
  const [activeRows, trashedRows] = await Promise.all([
    collectRawItemsByStatus(ctx, RESOURCE_STATUS.active),
    collectRawItemsByStatus(ctx, RESOURCE_STATUS.trashed),
  ])
  const items = await enhanceSidebarItemRows(
    ctx,
    await resolveResourceRowsByAccess(ctx, [...activeRows, ...trashedRows], PERMISSION_LEVEL.VIEW),
  )
  const active: Array<AnyResource> = []
  const trash: Array<AnyResource> = []
  for (const item of items) {
    if (item.isActive) {
      active.push(item)
    } else if (item.deletionTime !== null) {
      trash.push(item)
    }
  }
  trash.sort((a, b) => b.deletionTime! - a.deletionTime!)
  return { active, trash }
}

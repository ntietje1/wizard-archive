import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'

export interface DropPlanningContext {
  campaignId: Id<'campaigns'> | null
  campaignName: string | null
  isDm: boolean
}

export type SurfaceDropPlanningContext = Pick<DropPlanningContext, 'campaignId'>

export function actorFromDropPlanningContext(ctx: DropPlanningContext) {
  return { role: ctx.isDm ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player }
}

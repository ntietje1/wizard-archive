import type { Id } from 'convex/_generated/dataModel'

export interface DropPlanningContext {
  isDm: boolean
  campaignId: Id<'campaigns'> | null
  campaignName: string | null
}

export type SurfaceDropPlanningContext = Pick<DropPlanningContext, 'campaignId'>

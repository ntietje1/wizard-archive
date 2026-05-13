import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemDropPlanningContext } from '~/features/filesystem/filesystem-drop-planner'

export interface DropPlanningContext extends FileSystemDropPlanningContext {
  campaignId: Id<'campaigns'> | null
  campaignName: string | null
}

export type SurfaceDropPlanningContext = Pick<DropPlanningContext, 'campaignId'>

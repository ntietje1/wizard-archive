import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'

export type Session = ConvexValidatorFields<'sessions'> & {
  campaignId: Id<'campaigns'>
  name: string | null
  startedAt: number
  endedAt: number | null
}

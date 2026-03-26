import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export type Session = CommonValidatorFields<'sessions'> & {
  campaignId: Id<'campaigns'>
  name: string | null
  startedAt: number
  endedAt: number | null
}

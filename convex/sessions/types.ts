import type { Id } from '../_generated/dataModel'

export type Session = {
  _id: Id<'sessions'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  name?: string
  startedAt: number
  endedAt?: number
  updatedAt: number
}

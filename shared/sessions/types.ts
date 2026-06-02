import type { CampaignId, SessionId } from '../common/ids'

export type Session = {
  _id: SessionId
  _creationTime: number
  campaignId: CampaignId
  name: string | null
  startedAt: number
  endedAt: number | null
}

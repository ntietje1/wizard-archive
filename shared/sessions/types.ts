import type { CampaignId, SessionId } from '../common/ids'

export type Session = {
  id: SessionId
  createdAt: number
  campaignId: CampaignId
  name: string | null
  startedAt: number
  endedAt: number | null
}

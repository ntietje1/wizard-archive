import type { CampaignId } from '../common/ids'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

export type Session = {
  id: SessionId
  createdAt: number
  campaignId: CampaignId
  name: string | null
  startedAt: number
  endedAt: number | null
}

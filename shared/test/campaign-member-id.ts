import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testCampaignMemberId(label: string): CampaignMemberId {
  return deterministicUuidV7(label) as CampaignMemberId
}

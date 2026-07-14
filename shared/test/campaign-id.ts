import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testCampaignId(label: string): CampaignId {
  return deterministicUuidV7(label) as CampaignId
}

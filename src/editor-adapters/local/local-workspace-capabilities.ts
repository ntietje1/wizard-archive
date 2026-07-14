import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

export function canMutateLocalWorkspace({
  canEdit,
  selectedViewAsPlayerId,
}: {
  canEdit: boolean
  selectedViewAsPlayerId?: CampaignMemberId
}) {
  return canEdit && selectedViewAsPlayerId === undefined
}

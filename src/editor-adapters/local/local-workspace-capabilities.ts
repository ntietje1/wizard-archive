import type { CampaignMemberId } from 'shared/common/ids'

export function canMutateLocalWorkspace({
  canEdit,
  selectedViewAsPlayerId,
}: {
  canEdit: boolean
  selectedViewAsPlayerId?: CampaignMemberId
}) {
  return canEdit && selectedViewAsPlayerId === undefined
}

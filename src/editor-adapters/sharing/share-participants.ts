import type { EditorShareParticipant } from '@wizard-archive/editor/sharing'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { getUserDisplayName } from '@wizard-archive/ui/utils/user-display-name'

export function toEditorShareParticipant(member: CampaignMemberSummary): EditorShareParticipant {
  return {
    id: member.id,
    displayName: getUserDisplayName(member.userProfile),
    profileId: member.userId,
    username: member.userProfile.username,
    imageUrl: member.userProfile.imageUrl,
  }
}

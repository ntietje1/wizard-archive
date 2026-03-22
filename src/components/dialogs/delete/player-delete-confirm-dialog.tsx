import { useCallback } from 'react'
import { toast } from 'sonner'
import { CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { CampaignMember } from 'convex/campaigns/types'
import { useAppMutation } from '~/hooks/useAppMutation'

interface PlayerDeleteConfirmDialogProps {
  player: CampaignMember
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function PlayerDeleteConfirmDialog({
  player,
  isDeleting,
  onConfirm,
  onClose,
}: PlayerDeleteConfirmDialogProps) {
  const updateMemberStatus = useAppMutation(
    api.campaigns.mutations.updateCampaignMemberStatus,
    { errorMessage: 'Failed to remove player' },
  )

  const handleConfirm = useCallback(async () => {
    try {
      await updateMemberStatus.mutateAsync({
        memberId: player._id,
        status: CAMPAIGN_MEMBER_STATUS.Removed,
      })
      toast.success('Player removed successfully')
      onConfirm?.()
    } catch (error) {
      console.error(error)
    }
    onClose()
  }, [updateMemberStatus, player._id, onConfirm, onClose])

  const playerName = player.userProfile.name ?? 'this player'

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Remove Player"
      description={`Are you sure you want to remove ${playerName} from the campaign? This will revoke their access. You can undo this action in the player requests section.`}
      confirmLabel={`Remove ${playerName}`}
      confirmVariant="destructive"
      isLoading={updateMemberStatus.isPending}
    />
  )
}

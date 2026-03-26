import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { api } from 'convex/_generated/api'
import type { CampaignMember } from 'convex/campaigns/types'
import { SettingsSubAlertDialogContent } from '~/features/settings/components/settings-sub-dialog'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { logger } from '~/shared/utils/logger'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/features/shadcn/components/alert-dialog'

export function RemovePlayerDialog({
  player,
  isOpen,
  onClose,
}: {
  player: CampaignMember | undefined
  isOpen: boolean
  onClose: () => void
}) {
  const updateMemberStatus = useAppMutation(
    api.campaigns.mutations.updateCampaignMemberStatus,
    { errorMessage: 'Failed to remove player' },
  )

  const playerName = player?.userProfile.name ?? 'this player'

  const handleConfirm = async () => {
    if (!player) return
    try {
      await updateMemberStatus.mutateAsync({
        memberId: player._id,
        status: CAMPAIGN_MEMBER_STATUS.Removed,
      })
      toast.success('Player removed successfully')
    } catch (error) {
      logger.error(error)
    }
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SettingsSubAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Player</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {playerName} from the campaign? This
            will revoke their access. You can undo this action in the player
            requests section.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
          >
            {updateMemberStatus.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Remove ${playerName}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </SettingsSubAlertDialogContent>
    </AlertDialog>
  )
}

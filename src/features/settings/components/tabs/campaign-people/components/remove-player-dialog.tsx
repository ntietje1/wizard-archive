import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { SettingsSubAlertDialogContent } from '~/features/settings/components/settings-sub-dialog'
import { useUpdateCampaignMemberStatusMutation } from '~/features/campaigns/hooks/use-campaign-operations'
import { handleError } from '~/shared/utils/logger'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@wizard-archive/ui/shadcn/components/alert-dialog'

export function RemovePlayerDialog({
  player,
  campaignId,
  isOpen,
  onClose,
}: {
  player: CampaignMemberSummary | undefined
  campaignId: Id<'campaigns'>
  isOpen: boolean
  onClose: () => void
}) {
  const updateMemberStatus = useUpdateCampaignMemberStatusMutation()

  const playerName = player?.userProfile.name ?? 'this player'

  const handleConfirm = async () => {
    if (!player) return
    try {
      await updateMemberStatus.mutateAsync({
        campaignId,
        memberId: player.id,
        status: CAMPAIGN_MEMBER_STATUS.Removed,
      })
      toast.success('Player removed successfully')
    } catch (error) {
      handleError(error, 'Failed to remove player')
    }
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SettingsSubAlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Player</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {playerName} from the campaign? This will revoke their
            access. You can undo this action in the player requests section.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
          >
            {updateMemberStatus.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Remove ${playerName}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </SettingsSubAlertDialogContent>
    </AlertDialog>
  )
}

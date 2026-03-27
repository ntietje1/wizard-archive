import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { Campaign } from 'convex/campaigns/types'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'

interface CampaignDeleteConfirmDialogProps {
  campaign: Campaign
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function CampaignDeleteConfirmDialog({
  campaign,
  isDeleting,
  onConfirm,
  onClose,
}: CampaignDeleteConfirmDialogProps) {
  const deleteCampaign = useAppMutation(api.campaigns.mutations.deleteCampaign)

  const handleConfirm = async () => {
    await deleteCampaign
      .mutateAsync({ campaignId: campaign._id })
      .then(() => {
        toast.success('Campaign deleted successfully')
      })
      .catch((error: unknown) => {
        handleError(error, 'Failed to delete campaign')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Campaign"
      description={`Are you sure you want to delete "${campaign.name}"? This will permanently delete the entire campaign including all notes, characters, locations, and settings. This action cannot be undone.`}
      confirmLabel={`Delete ${campaign.name}`}
      confirmVariant="destructive"
      isLoading={deleteCampaign.isPending}
    />
  )
}

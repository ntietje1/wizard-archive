import { toast } from 'sonner'
import type { Campaign } from 'shared/campaigns/types'
import { ConfirmationDialog } from '@wizard-archive/ui/components/confirmation-dialog'
import { useDeleteCampaignMutation } from '~/features/campaigns/hooks/use-campaign-operations'
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
  const deleteCampaign = useDeleteCampaignMutation()

  const handleConfirm = async () => {
    await deleteCampaign
      .mutateAsync({ campaignId: campaign.id })
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

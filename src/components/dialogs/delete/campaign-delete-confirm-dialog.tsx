import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { Campaign } from 'convex/campaigns/types'

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
  const deleteCampaign = useMutation({
    mutationFn: useConvexMutation(api.campaigns.mutations.deleteCampaign),
  })

  const handleConfirm = useCallback(async () => {
    await deleteCampaign
      .mutateAsync({ campaignId: campaign._id })
      .then(() => {
        toast.success('Campaign deleted successfully')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete campaign')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteCampaign, campaign._id, onConfirm, onClose])

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

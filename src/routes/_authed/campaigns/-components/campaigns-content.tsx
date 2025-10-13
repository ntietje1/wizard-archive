import { useState } from 'react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import type { CampaignWithMembership } from 'convex/campaigns/types'
import { api } from 'convex/_generated/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { Edit, Notebook, Plus, Sword, Trash2, User, Users } from '~/lib/icons'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { CampaignDialog } from './campaign-dialog'
import type { Id } from 'convex/_generated/dataModel'
import { CampaignsContentError } from './campaigns-content-error'

export function CampaignsContent() {
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [editingCampaignId, setEditingCampaignId] =
    useState<Id<'campaigns'> | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<'campaigns'> | null>(null)

  const campaigns = useQuery(
    convexQuery(api.campaigns.queries.getUserCampaigns, {}),
  )
  const deleteCampaign = useMutation({
    mutationFn: useConvexMutation(api.campaigns.mutations.deleteCampaign),
  })

  const currentlyEditingCampaign = campaigns.data?.find(
    (campaignWithMembership: CampaignWithMembership) =>
      campaignWithMembership.campaign._id === editingCampaignId,
  )
  const currentlyDeletingCampaign = campaigns.data?.find(
    (campaignWithMembership: CampaignWithMembership) =>
      campaignWithMembership.campaign._id === deletingCampaignId,
  )

  if (campaigns.status === 'error') {
    return <CampaignsContentError />
  }

  if (campaigns.status === 'pending' || !campaigns.data) {
    return <CampaignsContentLoading />
  }

  const handleDeleteCampaign = async () => {
    if (!deletingCampaignId) return

    try {
      await deleteCampaign.mutateAsync({
        campaignId: deletingCampaignId,
      })

      toast.success('Campaign deleted successfully')
      setDeletingCampaignId(null)
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      toast.error('Failed to delete campaign')
    }
  }

  if (campaigns.data.length === 0) {
    return (
      <>
        <ContentGrid className="flex-1">
          <EmptyState
            icon={Sword}
            title="No campaigns yet"
            description="Create your first campaign to start sharing notes and managing your TTRPG adventures."
            action={{
              label: 'Create Your First Campaign',
              onClick: () => {
                setCreatingCampaign(true)
              },
              icon: Plus,
            }}
            className="col-span-full md:col-span-2 lg:col-span-3 max-w-2xl mx-auto"
          />
        </ContentGrid>

        <CampaignDialog
          mode="create"
          isOpen={creatingCampaign}
          onClose={() => setCreatingCampaign(false)}
        />
      </>
    )
  }

  return (
    <>
      <ContentGrid className="flex-1">
        {/* Create New Campaign Card */}
        {campaigns.data.length > 0 && (
          <CreateActionCard
            onClick={() => {
              setCreatingCampaign(true)
              console.log('creating campaign')
            }}
            title="New Campaign"
            description="Start a new adventure with your party"
            icon={Sword}
            minHeight="h-64"
          />
        )}

        {/* Existing Campaigns */}
        {campaigns.data
          .sort((a, b) => b.campaign._creationTime - a.campaign._creationTime)
          .map((campaignWithMembership: CampaignWithMembership) => {
            const campaign = campaignWithMembership.campaign
            const campaignMember = campaignWithMembership.member
            return (
              <ContentCard
                key={campaign._id}
                title={campaign.name}
                description={campaign.description}
                className="block h-64 w-full"
                badges={[
                  {
                    text: campaign.status,
                    icon: Users,
                    variant: 'secondary',
                  },
                  {
                    text: campaignMember.role,
                    icon: User,
                    variant: 'secondary',
                  },
                  {
                    text: campaign.noteCount?.toString() ?? '0' + ' notes',
                    icon: Notebook,
                    variant: 'secondary',
                  },
                ]}
                actionButtons={
                  campaignMember.role === 'DM'
                    ? [
                        {
                          icon: Edit,
                          onClick: (e: React.MouseEvent) => {
                            e.stopPropagation()
                            setEditingCampaignId(campaign._id)
                          },
                          'aria-label': 'Edit campaign',
                        },
                        {
                          icon: Trash2,
                          onClick: (e: React.MouseEvent) => {
                            e.stopPropagation()
                            setDeletingCampaignId(campaign._id)
                          },
                          'aria-label': 'Delete campaign',
                          variant: 'destructive-subtle',
                        },
                      ]
                    : undefined
                }
                linkWrapper={(children) => (
                  <Link
                    to={`/campaigns/$dmUsername/$campaignSlug/notes`}
                    params={{
                      dmUsername: campaign.dmUserProfile.username,
                      campaignSlug: campaign.slug,
                    }}
                  >
                    {children}
                  </Link>
                )}
              />
            )
          })}
      </ContentGrid>

      <CampaignDialog
        mode="create"
        isOpen={creatingCampaign}
        onClose={() => setCreatingCampaign(false)}
      />

      <CampaignDialog
        mode="edit"
        isOpen={editingCampaignId !== null}
        onClose={() => setEditingCampaignId(null)}
        campaignWithMembership={currentlyEditingCampaign ?? undefined}
      />

      <ConfirmationDialog
        isOpen={!!deletingCampaignId}
        onClose={() => setDeletingCampaignId(null)}
        onConfirm={handleDeleteCampaign}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${currentlyDeletingCampaign?.campaign.name}"? This will permanently delete the entire campaign including all notes, characters, locations, and settings. This action cannot be undone.`}
        confirmLabel="Delete Campaign"
        isLoading={false}
        icon={Sword}
      />
    </>
  )
}

function CampaignsContentLoading() {
  return <CardGridSkeleton count={4} showCreateCard={true} cardHeight="h-64" />
}

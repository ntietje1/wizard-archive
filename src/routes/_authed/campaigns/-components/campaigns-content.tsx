import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { CampaignDialog } from './campaign-dialog'
import { CampaignsContentError } from './campaigns-content-error'
import type { Campaign } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { Edit, Plus, Sword, Trash2, User, Users } from '~/lib/icons'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { CampaignDeleteConfirmDialog } from '~/components/dialogs/delete/campaign-delete-confirm-dialog'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'

export function CampaignsContent() {
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [editingCampaignId, setEditingCampaignId] =
    useState<Id<'campaigns'> | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] =
    useState<Id<'campaigns'> | null>(null)

  const campaigns = useQuery(
    convexQuery(api.campaigns.queries.getUserCampaigns, {}),
  )

  const currentlyEditingCampaign = campaigns.data?.find(
    (campaign: Campaign) => campaign._id === editingCampaignId,
  )
  const currentlyDeletingCampaign = campaigns.data?.find(
    (campaign: Campaign) => campaign._id === deletingCampaignId,
  )

  if (campaigns.status === 'error') {
    return <CampaignsContentError />
  }

  if (campaigns.status === 'pending') {
    return <CampaignsContentLoading />
  }

  const handleDeleteSuccess = () => {
    setDeletingCampaignId(null)
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
          .sort((a, b) => b._creationTime - a._creationTime)
          .map((campaign: Campaign) => {
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
                    text: campaign.myMembership?.role ?? 'None',
                    icon: User,
                    variant: 'secondary',
                  },
                ]}
                actionButtons={
                  campaign.myMembership?.role === 'DM'
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
                          variant: 'destructive',
                        },
                      ]
                    : undefined
                }
                linkWrapper={(children) => (
                  <Link
                    to={`/campaigns/$dmUsername/$campaignSlug/editor`}
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
        campaign={currentlyEditingCampaign ?? undefined}
      />

      {currentlyDeletingCampaign && (
        <CampaignDeleteConfirmDialog
          campaign={currentlyDeletingCampaign}
          isDeleting={!!deletingCampaignId}
          onClose={() => setDeletingCampaignId(null)}
          onConfirm={handleDeleteSuccess}
        />
      )}
    </>
  )
}

function CampaignsContentLoading() {
  return <CardGridSkeleton count={4} showCreateCard={true} cardHeight="h-64" />
}

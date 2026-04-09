import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { Edit, Plus, Sword, Trash2, User, Users } from 'lucide-react'
import { CampaignsContentError } from './campaigns-content-error'
import type { Campaign } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { CampaignDialog } from '~/features/campaigns/components/campaign-dialog'
import { ContentGrid } from '~/features/campaigns/components/content-grid/content-grid'
import { EmptyState } from '~/features/campaigns/components/content-grid/empty-state'
import { CreateActionCard } from '~/features/campaigns/components/content-grid/create-action-card'
import { ContentCard } from '~/features/campaigns/components/content-grid/content-card'
import { CampaignDeleteConfirmDialog } from '~/features/campaigns/components/campaign-delete-confirm-dialog'
import { CardGridSkeleton } from '~/features/campaigns/components/content-grid/card-grid-skeleton'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function CampaignsContent() {
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<Id<'campaigns'> | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<Id<'campaigns'> | null>(null)

  const campaigns = useAuthQuery(api.campaigns.queries.getUserCampaigns, {})

  const currentlyEditingCampaign = campaigns.data?.find(
    (campaign: Campaign) => campaign._id === editingCampaignId,
  )
  const currentlyDeletingCampaign = campaigns.data?.find(
    (campaign: Campaign) => campaign._id === deletingCampaignId,
  )

  if (campaigns.status === 'pending' && !campaigns.data) {
    return <CampaignsContentLoading />
  }

  if (campaigns.status === 'error' && !campaigns.data) {
    return <CampaignsContentError />
  }

  const handleDeleteSuccess = () => {
    setDeletingCampaignId(null)
  }

  return (
    <>
      <ContentGrid className="flex-1">
        {!campaigns.data?.length ? (
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
        ) : (
          <>
            <CreateActionCard
              onClick={() => {
                setCreatingCampaign(true)
              }}
              title="New Campaign"
              description="Start a new adventure with your party"
              icon={Sword}
              minHeight="h-64"
            />
            {[...(campaigns.data ?? [])]
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
          </>
        )}
      </ContentGrid>

      <CampaignDialog
        mode="create"
        isOpen={creatingCampaign}
        onClose={() => setCreatingCampaign(false)}
        campaigns={campaigns.data ?? []}
      />

      <CampaignDialog
        mode="edit"
        isOpen={editingCampaignId !== null}
        onClose={() => setEditingCampaignId(null)}
        campaign={currentlyEditingCampaign ?? undefined}
        campaigns={campaigns.data ?? []}
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

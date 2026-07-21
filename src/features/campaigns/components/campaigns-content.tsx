import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2, Plus, Sword, Trash2, User, Users } from 'lucide-react'
import { CampaignsContentError } from './campaigns-content-error'
import type { Campaign } from 'shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { CampaignDialog } from '~/features/campaigns/components/campaign-dialog'
import { ContentGrid } from '@wizard-archive/ui/components/content-grid'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { EmptyState } from '~/features/campaigns/components/content-grid/empty-state'
import { CreateActionCard } from '~/features/campaigns/components/content-grid/create-action-card'
import { ContentCard } from '~/features/campaigns/components/content-grid/content-card'
import { CampaignDeleteConfirmDialog } from '~/features/campaigns/components/campaign-delete-confirm-dialog'
import { CardGridSkeleton } from '~/features/campaigns/components/content-grid/card-grid-skeleton'
import { useUserCampaignsQuery } from '~/features/campaigns/hooks/use-campaign-operations'

export function CampaignsContent() {
  return (
    <ErrorBoundary FallbackComponent={CampaignsContentError}>
      <CampaignsContentProjection />
    </ErrorBoundary>
  )
}

function CampaignsContentProjection() {
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [deletingCampaignId, setDeletingCampaignId] = useState<CampaignId | null>(null)

  const campaigns = useUserCampaignsQuery()

  const currentlyDeletingCampaign = campaigns.results.find(
    (campaign: Campaign) => campaign.id === deletingCampaignId,
  )

  if (campaigns.status === 'LoadingFirstPage') {
    return <CampaignsContentLoading />
  }

  const handleDeleteSuccess = () => {
    setDeletingCampaignId(null)
  }

  return (
    <>
      <ContentGrid className="flex-1">
        {campaigns.results.length === 0 && campaigns.status === 'Exhausted' ? (
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
            {Array.from(campaigns.results)
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((campaign: Campaign) => {
                return (
                  <ContentCard
                    key={campaign.id}
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
                              icon: Trash2,
                              onClick: (e: React.MouseEvent) => {
                                e.stopPropagation()
                                setDeletingCampaignId(campaign.id)
                              },
                              'aria-label': 'Delete campaign',
                              variant: 'destructive',
                            },
                          ]
                        : undefined
                    }
                    linkWrapper={(children) => (
                      <Link
                        to="/campaigns/$dmUsername/$campaignSlug/editor"
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
        {(campaigns.status === 'CanLoadMore' || campaigns.status === 'LoadingMore') && (
          <div className="col-span-full flex justify-center py-4">
            <button
              type="button"
              aria-busy={campaigns.status === 'LoadingMore'}
              disabled={campaigns.status === 'LoadingMore'}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              onClick={campaigns.loadMore}
            >
              {campaigns.status === 'LoadingMore' && <Loader2 className="size-4 animate-spin" />}
              {campaigns.status === 'LoadingMore'
                ? 'Loading more campaigns…'
                : 'Load more campaigns'}
            </button>
          </div>
        )}
      </ContentGrid>

      <CampaignDialog isOpen={creatingCampaign} onClose={() => setCreatingCampaign(false)} />

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

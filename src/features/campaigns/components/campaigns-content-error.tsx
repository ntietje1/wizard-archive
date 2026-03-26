import { AlertTriangle } from 'lucide-react'
import { ContentGrid } from '~/features/campaigns/components/content-grid/content-grid'
import { EmptyState } from '~/features/campaigns/components/content-grid/empty-state'

export const CampaignsContentError = () => {
  return (
    <ContentGrid>
      <EmptyState
        icon={AlertTriangle}
        title="Error Loading Campaigns"
        description="There was an error loading your campaigns. Please try refreshing the page. If the problem persists, contact support."
        action={{
          label: 'Refresh Page',
          onClick: () => window.location.reload(),
        }}
        className="col-span-full md:col-span-2 lg:col-span-3 max-w-2xl mx-auto"
      />
    </ContentGrid>
  )
}

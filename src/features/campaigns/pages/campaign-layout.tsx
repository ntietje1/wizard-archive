import { Outlet } from '@tanstack/react-router'
import { CampaignProvider } from '~/features/campaigns/contexts/campaign-context'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { ErrorFallback } from '@wizard-archive/ui/components/error-fallback'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function CampaignLayout() {
  return (
    <CampaignProvider>
      <CampaignRouteContent />
    </CampaignProvider>
  )
}

function CampaignRouteContent() {
  const { campaignSlug, dmUsername } = useCampaign()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ErrorBoundary FallbackComponent={ErrorFallback} key={`${dmUsername}/${campaignSlug}`}>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}

import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import {
  buildCampaignContextValue,
  CampaignContext,
  useOptionalCampaignRoute,
} from '~/features/campaigns/hooks/useCampaign'
import { resolveCampaignLookupState } from '~/features/campaigns/campaign-lookup-state'
import { CampaignNotFound } from '~/features/campaigns/components/campaign-not-found'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { useCampaignBySlugQuery } from '~/features/campaigns/hooks/use-campaign-operations'

function CampaignLookupFailed({ onRetry }: { onRetry: () => unknown }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Could Not Load Campaign</h1>
        <p className="text-muted-foreground mb-4">
          Something went wrong while loading this campaign. Please try again.
        </p>
        <Button onClick={() => void onRetry()}>Try Again</Button>
      </div>
    </div>
  )
}

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const identity = useOptionalCampaignRoute()
  const campaign = useCampaignBySlugQuery(identity)

  if (!identity) {
    return <CampaignNotFound />
  }

  const campaignState = resolveCampaignLookupState(campaign)

  if (campaignState.status === 'not_found_or_forbidden') {
    return <CampaignNotFound />
  }

  if (campaignState.status === 'failed') {
    return <CampaignLookupFailed onRetry={campaignState.retry} />
  }

  const value: CampaignContextType = buildCampaignContextValue(identity, campaign)

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
}

import { api } from 'convex/_generated/api'
import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import {
  buildCampaignContextValue,
  CampaignContext,
  useOptionalCampaignRoute,
} from '~/features/campaigns/hooks/useCampaign'
import { CampaignNotFound } from '~/features/campaigns/components/campaign-not-found'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const identity = useOptionalCampaignRoute()
  const campaign = useAuthQuery(
    api.campaigns.queries.getCampaignBySlug,
    identity
      ? {
          dmUsername: identity.dmUsername,
          slug: identity.campaignSlug,
        }
      : 'skip',
  )

  if (!identity) {
    return <CampaignNotFound />
  }

  if (!campaign.data && campaign.status === 'error') {
    return <CampaignNotFound />
  }

  const value: CampaignContextType = buildCampaignContextValue(identity, campaign)

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
}

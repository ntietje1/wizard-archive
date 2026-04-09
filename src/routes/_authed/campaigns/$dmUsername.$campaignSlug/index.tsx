import { createFileRoute } from '@tanstack/react-router'
import { CampaignRedirectPage } from '~/features/campaigns/pages/campaign-redirect-page'

export const Route = createFileRoute('/_authed/campaigns/$dmUsername/$campaignSlug/')({
  component: CampaignRedirectPage,
})

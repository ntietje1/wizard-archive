import { createFileRoute } from '@tanstack/react-router'
import { CampaignSettingsPage } from '~/features/campaigns/pages/campaign-settings-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/settings/',
)({
  component: CampaignSettingsPage,
})

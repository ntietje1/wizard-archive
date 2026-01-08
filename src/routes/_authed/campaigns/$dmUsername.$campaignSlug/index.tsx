import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useCampaign } from '~/hooks/useCampaign'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/',
)({
  component: CampaignsIndexPage,
})

function CampaignsIndexPage() {
  const { dmUsername, campaignSlug } = useCampaign()
  return (
    <Navigate
      to="/campaigns/$dmUsername/$campaignSlug/editor"
      params={{ dmUsername, campaignSlug }}
      replace
    />
  )
}

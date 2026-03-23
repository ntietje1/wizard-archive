import { Navigate } from '@tanstack/react-router'
import { useCampaign } from '../hooks/useCampaign'

export function CampaignRedirectPage() {
  const { dmUsername, campaignSlug } = useCampaign()
  return (
    <Navigate
      to="/campaigns/$dmUsername/$campaignSlug/editor"
      params={{ dmUsername, campaignSlug }}
      replace
    />
  )
}

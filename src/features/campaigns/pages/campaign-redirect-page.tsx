import { Navigate } from '@tanstack/react-router'
import { useCampaign } from '../hooks/useCampaign'

export function CampaignRedirectPage() {
  const { campaignSlug, dmUsername } = useCampaign()
  return (
    <Navigate
      to="/campaigns/$dmUsername/$campaignSlug/editor"
      params={{ campaignSlug, dmUsername }}
      replace
    />
  )
}

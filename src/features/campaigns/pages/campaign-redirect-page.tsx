import { Navigate } from '@tanstack/react-router'
import { useCampaign } from '../hooks/useCampaign'

export function CampaignRedirectPage() {
  const { campaignId } = useCampaign()
  return <Navigate to="/campaigns/$campaignId/editor" params={{ campaignId }} replace />
}

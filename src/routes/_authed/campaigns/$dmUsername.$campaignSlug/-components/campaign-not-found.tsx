import { Link } from '@tanstack/react-router'
import { useCampaign } from '~/hooks/useCampaign'

export function CampaignNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Campaign Not Found</h1>
        <p className="text-gray-600 mb-4">
          {
            "The campaign you're looking for doesn't exist, has been moved, or you don't have access to it."
          }
        </p>
        <Link
          to="/campaigns"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Campaigns
        </Link>
      </div>
    </div>
  )
}

export function CampaignNotFoundWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership } = useCampaign()

  // use server data even if client errored
  const hasData = !!campaignWithMembership.data
  const isError = campaignWithMembership.status === 'error'
  const showError = !hasData && isError

  if (showError) {
    return <CampaignNotFound />
  }
  return children
}

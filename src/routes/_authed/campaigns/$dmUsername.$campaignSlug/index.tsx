import { createFileRoute } from '@tanstack/react-router'
import { useCampaign } from '~/hooks/useCampaign'
import { FileText, MapPin, Settings, Sword, User, Users } from '~/lib/icons'
import { LoadingPage } from '~/components/loading/loading-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/',
)({
  component: CampaignsIndexPage,
})

function CampaignsIndexPage() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign

  if (campaignWithMembership.status === 'pending' || !campaign) {
    return <LoadingPage />
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{campaign.name}</h1>
        {campaign.description && (
          <p className="text-slate-600 text-lg">{campaign.description}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Welcome to your campaign!
        </h2>
        <p className="text-slate-600 mb-4">
          Use the sidebar navigation to access different sections of your
          campaign:
        </p>
        <ul className="space-y-2 text-slate-600">
          <li className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Notes:</strong> Manage campaign notes and documentation
            </span>
          </li>
          <li className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Characters:</strong> Manage player and NPC characters
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Locations:</strong> Track important places and maps
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Players:</strong> Manage player information and
              permissions
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Sword className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Scene:</strong> Current scene and encounter management
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-amber-600" />
            <span>
              <strong>Settings:</strong> Campaign configuration and preferences
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

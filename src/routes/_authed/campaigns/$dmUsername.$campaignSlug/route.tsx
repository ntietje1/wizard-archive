import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CampaignProvider } from '~/contexts/CampaignContext'
import { NavigationSidebar } from '../-components/navigation-sidebar'
import { CampaignNotFoundWrapper } from './-components/campaign-not-found'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <CampaignProvider>
      <CampaignNotFoundWrapper>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* // TODO: remove this */}
          <NavigationSidebar />
          <Outlet />
        </div>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}

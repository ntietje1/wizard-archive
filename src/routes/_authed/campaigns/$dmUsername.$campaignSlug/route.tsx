import { Outlet, createFileRoute } from '@tanstack/react-router'
import { NavigationSidebar } from '../-components/navigation-sidebar'
import { CampaignNotFoundWrapper } from './-components/campaign-not-found'
import { CampaignProvider } from '~/contexts/CampaignContext'
import { FileSidebarProvider } from '~/contexts/FileSidebarContext'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <CampaignProvider>
      <CampaignNotFoundWrapper>
        <FileSidebarProvider>
          <div className="flex flex-1 min-h-0">
            <NavigationSidebar />
            <SidebarLayout>
              <Outlet />
            </SidebarLayout>
          </div>
        </FileSidebarProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}

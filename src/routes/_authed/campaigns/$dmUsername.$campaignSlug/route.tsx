import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CampaignProvider } from '~/contexts/CampaignContext'
import { ContextMenuProvider } from '~/components/context-menu/components/ContextMenuProvider'
import { NavigationSidebar } from '../-components/navigation-sidebar'
import { CampaignNotFoundWrapper } from './-components/campaign-not-found'
import { FileSidebarProvider } from '~/contexts/FileSidebarContext'

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
          <ContextMenuProvider>
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <NavigationSidebar />
              <Outlet />
            </div>
          </ContextMenuProvider>
        </FileSidebarProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}

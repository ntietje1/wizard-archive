import { Outlet, createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { NavigationSidebar } from '../-components/navigation-sidebar'
import { CampaignNotFoundWrapper } from './-components/campaign-not-found'
import { CampaignProvider } from '~/contexts/CampaignContext'
import { AllSidebarItemsProvider } from '~/contexts/AllSidebarItemsProvider'
import { SidebarItemMutationsProvider } from '~/contexts/SidebarItemMutationsProvider'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'
import { SidebarLayoutProvider } from '~/contexts/SidebarLayoutContext'
import { SessionProvider } from '~/contexts/SessionContext'
import { EditorNavigationProvider } from '~/contexts/EditorNavigationProvider'
import { SidebarDndWrapper } from '~/components/notes-page/sidebar/SidebarDndWrapper'
import { ViewAsBanner } from '~/components/notes-page/editor/view-as-banner'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug',
)({
  beforeLoad: async ({ context, params }) => {
    const campaign = await context.queryClient.ensureQueryData(
      convexQuery(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: params.dmUsername,
        slug: params.campaignSlug,
      }),
    )
    if (campaign?._id) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.editors.queries.getCurrentEditor, {
          campaignId: campaign._id,
        }),
      )
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <CampaignProvider>
      <CampaignNotFoundWrapper>
        <SessionProvider>
          <AllSidebarItemsProvider>
            <SidebarItemMutationsProvider>
              <EditorNavigationProvider>
                <SidebarDndWrapper>
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex flex-1 min-h-0">
                      <SidebarLayoutProvider>
                        <NavigationSidebar />
                        <SidebarLayout>
                          <Outlet />
                        </SidebarLayout>
                      </SidebarLayoutProvider>
                    </div>
                    <ViewAsBanner />
                  </div>
                </SidebarDndWrapper>
              </EditorNavigationProvider>
            </SidebarItemMutationsProvider>
          </AllSidebarItemsProvider>
        </SessionProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}

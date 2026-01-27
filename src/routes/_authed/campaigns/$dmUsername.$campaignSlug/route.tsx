import { Outlet, createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { NavigationSidebar } from '../-components/navigation-sidebar'
import { CampaignNotFoundWrapper } from './-components/campaign-not-found'
import { CampaignProvider } from '~/contexts/CampaignContext'
import { FileSidebarProvider } from '~/contexts/FileSidebarContext'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'
import { SidebarLayoutProvider } from '~/contexts/SidebarLayoutContext'
import { EditorModeProvider } from '~/contexts/EditorModeContext'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug',
)({
  beforeLoad: async ({ context, params }) => {
    const campaignWithMembership = await context.queryClient.ensureQueryData(
      convexQuery(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: params.dmUsername,
        slug: params.campaignSlug,
      }),
    )

    if (campaignWithMembership?.campaign._id) {
      await context.queryClient.ensureQueryData(
        convexQuery(api.editors.queries.getCurrentEditor, {
          campaignId: campaignWithMembership.campaign._id,
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
        <FileSidebarProvider>
          <div className="flex flex-1 min-h-0">
            <SidebarLayoutProvider>
              <NavigationSidebar />
              <EditorModeProvider>
                <SidebarLayout>
                  <Outlet />
                </SidebarLayout>
              </EditorModeProvider>
            </SidebarLayoutProvider>
          </div>
        </FileSidebarProvider>
      </CampaignNotFoundWrapper>
    </CampaignProvider>
  )
}

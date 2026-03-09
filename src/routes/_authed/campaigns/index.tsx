import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { isAuthError } from '~/hooks/useAuthQuery'
import { CampaignsHeader } from './-components/campaigns-header'
import { CampaignsContent } from './-components/campaigns-content'
import { CampaignsFooter } from './-components/campaigns-footer'
import { UserMenu } from '~/components/auth/UserMenu'

export const Route = createFileRoute('/_authed/campaigns/')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        convexQuery(api.campaigns.queries.getUserCampaigns, {}),
      )
    } catch (e) {
      if (!isAuthError(e)) throw e
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-col flex-1">
      <div className="flex justify-end p-2 border-b bg-background">
        <UserMenu />
      </div>
      <div className="flex flex-col flex-1 p-8">
        <CampaignsHeader />
        <CampaignsContent />
        <CampaignsFooter />
      </div>
    </div>
  )
}

import { convexQuery } from '@convex-dev/react-query'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { isAuthError } from '~/hooks/useAuthQuery'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players',
)({
  beforeLoad: async ({ context, params }) => {
    try {
      const campaign = await context.queryClient.ensureQueryData(
        convexQuery(api.campaigns.queries.getCampaignBySlug, {
          dmUsername: params.dmUsername,
          slug: params.campaignSlug,
        }),
      )

      if (campaign?._id) {
        await context.queryClient.ensureQueryData(
          convexQuery(api.campaigns.queries.getPlayersByCampaign, {
            campaignId: campaign._id,
          }),
        )
      }
    } catch (e) {
      if (!isAuthError(e)) throw e
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

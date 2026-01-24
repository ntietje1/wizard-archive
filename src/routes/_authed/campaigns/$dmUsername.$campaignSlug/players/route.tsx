import { convexQuery } from '@convex-dev/react-query'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players',
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
        convexQuery(api.campaigns.queries.getPlayersByCampaign, {
          campaignId: campaignWithMembership.campaign._id,
        }),
      )
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

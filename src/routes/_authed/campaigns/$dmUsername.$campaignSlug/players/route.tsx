import { Outlet, createFileRoute } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { prefetchQuery } from '~/lib/prefetch'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players',
)({
  beforeLoad: async ({ context, params }) => {
    const campaign = await prefetchQuery(
      context.queryClient,
      api.campaigns.queries.getCampaignBySlug,
      { dmUsername: params.dmUsername, slug: params.campaignSlug },
    )

    if (campaign?._id) {
      await prefetchQuery(
        context.queryClient,
        api.campaigns.queries.getPlayersByCampaign,
        { campaignId: campaign._id },
      )
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

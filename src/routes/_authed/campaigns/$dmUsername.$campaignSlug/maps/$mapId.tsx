import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/maps/$mapId',
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/campaigns/$dmUsername/$campaignSlug/notes',
      params: {
        dmUsername: params.dmUsername,
        campaignSlug: params.campaignSlug,
      },
      search: {
        mapId: params.mapId,
      },
    })
  },
})

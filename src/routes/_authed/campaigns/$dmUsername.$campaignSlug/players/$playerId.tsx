import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const playerId = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
  }).playerId

  return <div>{playerId}</div>
}

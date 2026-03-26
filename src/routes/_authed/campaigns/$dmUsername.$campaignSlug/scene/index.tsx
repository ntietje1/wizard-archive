import { createFileRoute } from '@tanstack/react-router'
import { ScenePage } from '~/features/scene/pages/scene-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/scene/',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <ScenePage />
}

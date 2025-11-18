import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/maps',
)({
  component: MapsLayout,
})

function MapsLayout() {
  return <Outlet />
}

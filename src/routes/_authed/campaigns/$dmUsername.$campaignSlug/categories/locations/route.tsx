import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations',
)({
  component: LocationsLayout,
})

function LocationsLayout() {
  return <Outlet />
}

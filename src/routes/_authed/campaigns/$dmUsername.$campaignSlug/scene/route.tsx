import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/campaigns/$dmUsername/$campaignSlug/scene')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

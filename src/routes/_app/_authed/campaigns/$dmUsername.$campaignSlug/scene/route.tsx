import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_authed/campaigns/$dmUsername/$campaignSlug/scene')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Outlet />
}

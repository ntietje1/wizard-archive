import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_authed/campaigns')({
  component: CampaignsLayout,
})

function CampaignsLayout() {
  return <Outlet />
}

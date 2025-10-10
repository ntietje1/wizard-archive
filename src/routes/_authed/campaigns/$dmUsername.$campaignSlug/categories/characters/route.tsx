import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters',
)({
  component: CharactersLayout,
})

function CharactersLayout() {
  return <Outlet />
}

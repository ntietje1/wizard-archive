import { createFileRoute } from '@tanstack/react-router'
import { PlayersPage } from '~/features/players/pages/players-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players/',
)({
  component: PlayersPage,
})

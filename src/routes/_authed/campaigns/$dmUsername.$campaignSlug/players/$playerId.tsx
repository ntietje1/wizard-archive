import { createFileRoute } from '@tanstack/react-router'
import { PlayerDetailPage } from '~/features/players/pages/player-detail-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
)({
  component: PlayerDetailPage,
})

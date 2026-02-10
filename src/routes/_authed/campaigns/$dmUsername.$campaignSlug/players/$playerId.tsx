import { createFileRoute, useParams } from '@tanstack/react-router'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const playerId = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
  }).playerId

  return <ScrollArea className="flex-1 min-h-0">{playerId}</ScrollArea>
}

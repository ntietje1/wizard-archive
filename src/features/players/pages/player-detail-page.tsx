import { useParams } from '@tanstack/react-router'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function PlayerDetailPage() {
  const playerId = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/players/$playerId',
  }).playerId

  return <ScrollArea className="flex-1 min-h-0">{playerId}</ScrollArea>
}

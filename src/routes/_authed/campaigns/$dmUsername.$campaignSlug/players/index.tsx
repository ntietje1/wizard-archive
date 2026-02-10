import { createFileRoute } from '@tanstack/react-router'
import PlayersContent from './-components/players-content'
import PlayersHeader from './-components/players-header'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/players/',
)({
  component: PlayersPage,
})

function PlayersPage() {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-6">
        <PlayersHeader />
        <PlayersContent />
      </div>
    </ScrollArea>
  )
}

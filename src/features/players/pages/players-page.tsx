import PlayersContent from '../components/players-content'
import PlayersHeader from '../components/players-header'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function PlayersPage() {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-6">
        <PlayersHeader />
        <PlayersContent />
      </div>
    </ScrollArea>
  )
}

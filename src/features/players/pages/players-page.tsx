import PlayersContent from '../components/players-content'
import PlayersHeader from '../components/players-header'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function PlayersPage() {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-6">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <PlayersHeader />
          <PlayersContent />
        </ErrorBoundary>
      </div>
    </ScrollArea>
  )
}

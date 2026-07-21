import { useId, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error?: Error
  resetErrorBoundary?: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const stackTraceId = useId()
  const isDev = import.meta.env.DEV

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Something went wrong</p>
        {isDev && error && (
          <div className="max-w-md text-left">
            <p className="text-xs text-destructive">{error.message}</p>
            {error.stack && (
              <>
                <button
                  type="button"
                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDetails(!showDetails)}
                  aria-controls={stackTraceId}
                  aria-expanded={showDetails}
                >
                  {showDetails ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  Stack trace
                </button>
                <ScrollArea
                  id={stackTraceId}
                  hidden={!showDetails}
                  className="mt-1 max-h-48 rounded bg-muted text-xs text-muted-foreground"
                  contentClassName="p-2"
                  scrollOrientation="both"
                >
                  <pre>{error.stack}</pre>
                </ScrollArea>
              </>
            )}
          </div>
        )}
        {resetErrorBoundary && (
          <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

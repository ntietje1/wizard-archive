import { AlertTriangle } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'

export function ErrorFallback({
  resetErrorBoundary,
}: {
  error?: Error
  resetErrorBoundary?: () => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Something went wrong</p>
        {resetErrorBoundary && (
          <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

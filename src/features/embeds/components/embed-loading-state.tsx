import { LoadingSpinner } from '~/shared/components/loading-spinner'

type EmbedLoadingStateProps = {
  label?: string
}

export function EmbedLoadingState({ label = 'Loading embed' }: EmbedLoadingStateProps) {
  return (
    <output
      aria-label={label}
      data-testid="embed-loading-state"
      className="flex h-full min-h-24 w-full min-w-full items-center justify-center bg-muted/20 p-4 text-muted-foreground"
    >
      <LoadingSpinner size="lg" />
    </output>
  )
}

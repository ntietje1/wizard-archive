import { Play } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'

interface AssetPlaceholderProps {
  label: string
  aspectRatio?: string
  className?: string
  showPlayButton?: boolean
}

export function AssetPlaceholder({
  className,
  label,
  aspectRatio = '16/9',
  showPlayButton = false,
}: AssetPlaceholderProps) {
  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-secondary/35',
        className,
      )}
      style={{ aspectRatio }}
      aria-label={label}
    >
      {showPlayButton && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/90">
            <Play className="ml-0.5 size-6 text-primary-foreground" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative grid w-[82%] gap-4 md:grid-cols-[0.68fr_1fr]">
        <div className="space-y-3 rounded-lg border border-border/35 bg-background/35 p-4">
          <div className="h-3 w-2/3 rounded bg-muted-foreground/20" />
          <div className="h-3 w-1/2 rounded bg-muted-foreground/14" />
          <div className="h-3 w-3/4 rounded bg-muted-foreground/14" />
        </div>
        <div className="rounded-lg border border-border/35 bg-background/45 p-4">
          <div className="mb-4 h-24 rounded-md bg-muted-foreground/12" />
          <div className="space-y-2">
            <div className="h-3 rounded bg-muted-foreground/18" />
            <div className="h-3 w-4/5 rounded bg-muted-foreground/14" />
          </div>
        </div>
      </div>
    </div>
  )
}

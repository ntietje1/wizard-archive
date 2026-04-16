import { Play } from 'lucide-react'

interface AssetPlaceholderProps {
  label: string
  aspectRatio?: string
  showPlayButton?: boolean
}

export function AssetPlaceholder({
  label,
  aspectRatio = '16/9',
  showPlayButton = false,
}: AssetPlaceholderProps) {
  return (
    <div
      className="relative w-full rounded-lg border border-border/50 bg-secondary/50 flex items-center justify-center overflow-hidden"
      style={{ aspectRatio }}
    >
      {showPlayButton && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/90">
            <Play className="size-6 text-primary-foreground ml-0.5" />
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground px-8 text-center z-0">{label}</p>
    </div>
  )
}

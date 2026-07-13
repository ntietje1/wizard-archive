import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { MapLayer } from '../../game-maps/document-contract'

export function MapLayerSwitcher({
  layers,
  activeLayerId,
  onSelectLayer,
}: {
  layers: Array<MapLayer>
  activeLayerId: string | null
  onSelectLayer: (layerId: string) => void
}) {
  if (layers.length <= 1) return null

  return (
    <div
      aria-label="Map layers"
      className="absolute left-3 top-3 z-[1000] inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1 overflow-x-auto rounded-md border bg-background/95 p-1 shadow-sm"
      role="toolbar"
    >
      {layers.map((layer) => {
        const isActive = layer.id === activeLayerId

        return (
          <button
            key={layer.id}
            type="button"
            aria-pressed={isActive}
            className={cn(
              'h-7 shrink-0 rounded px-2 text-xs font-medium text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive && 'bg-muted text-foreground',
            )}
            onClick={() => onSelectLayer(layer.id)}
          >
            {layer.name}
          </button>
        )
      })}
    </div>
  )
}

import { Loader2 } from 'lucide-react'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import { MapPinsLayer } from '../../game-maps/viewer/map-pins-layer'
import { useMapImageStatus } from '../../game-maps/viewer/use-map-image-status'
import { MapImagePreview } from '../../game-maps/viewer/map-image-preview'
import { useEmbeddedMapState } from '../../game-maps/embedded-state-context'
import type { EmbedMediaLayoutReporter } from '../utils/media'
import { getIntrinsicAspectRatio } from '../utils/media'
import { resolveMapImage } from '../../game-maps/image-resolution'
import { filterMapPinsForLayer } from '../../game-maps/render-projection'

export function EmbeddedMapContent({
  map,
  onMediaLayout,
}: {
  map: MapItemWithContent
  onMediaLayout?: EmbedMediaLayoutReporter
}) {
  const embeddedMapState = useEmbeddedMapState(map)
  const activeMapImage = resolveMapImage(map)
  const activeLayer = activeMapImage.layer
  const activeLayerId = activeLayer?.id ?? null
  const activeMapImageUrl = activeMapImage.imageUrl
  const activeMapImageAlt = activeLayer ? `${map.name} - ${activeLayer.name}` : map.name || 'Map'
  const { imageLoaded, imageError, handleImageLoad, handleImageError } = useMapImageStatus(
    map.id,
    activeMapImageUrl,
  )

  if (!activeMapImageUrl || imageError) {
    return <MapImagePreview imageUrl={imageError ? null : activeMapImageUrl} />
  }
  if (embeddedMapState.status === 'unavailable') {
    return <MapImagePreview imageUrl={activeMapImageUrl} />
  }
  const { pins, isPinGhost } = embeddedMapState
  const visiblePins = filterMapPinsForLayer(pins, activeLayerId, map.layers ?? [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span className="sr-only">Loading embedded map</span>
        </div>
      )}

      <img
        src={activeMapImageUrl}
        alt={activeMapImageAlt}
        className="block h-full w-full select-none object-contain"
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          const aspectRatio = getIntrinsicAspectRatio(naturalWidth, naturalHeight)
          onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio })

          handleImageLoad(event)
        }}
        onError={handleImageError}
      />

      {imageLoaded && <MapPinsLayer pins={visiblePins} isPinGhost={isPinGhost} />}
    </div>
  )
}

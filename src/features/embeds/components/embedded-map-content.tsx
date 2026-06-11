import { Loader2 } from 'lucide-react'
import type { GameMapWithContent } from 'shared/game-maps/types'
import { MapPinsLayer } from '~/features/editor/components/viewer/map/map-pins-layer'
import { useMapImageStatus } from '~/features/editor/components/viewer/map/use-map-image-status'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { useEmbeddedMapStateResolver } from '../context/embedded-map-state-resolution'
import type { EmbedMediaLayoutReporter } from '../utils/embed-media'
import { getIntrinsicAspectRatio } from '../utils/embed-media'

export function EmbeddedMapContent({
  map,
  onMediaLayout,
}: {
  map: GameMapWithContent
  onMediaLayout?: EmbedMediaLayoutReporter
}) {
  const MapStateResolver = useEmbeddedMapStateResolver()
  const { imageLoaded, imageError, handleImageLoad, handleImageError } = useMapImageStatus(
    map._id,
    map.imageUrl,
  )

  return (
    <MapStateResolver map={map}>
      {({ pins, isPinGhost }) => {
        if (!map.imageUrl || imageError) {
          return <MapImagePreview imageUrl={imageError ? null : map.imageUrl} />
        }

        return (
          <div className="relative h-full w-full overflow-hidden bg-background">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="sr-only">Loading embedded map</span>
              </div>
            )}

            <img
              src={map.imageUrl}
              alt={map.name || 'Map'}
              className="block h-full w-full select-none object-contain"
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget
                const aspectRatio = getIntrinsicAspectRatio(naturalWidth, naturalHeight)
                onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio })

                handleImageLoad()
              }}
              onError={handleImageError}
            />

            {imageLoaded && <MapPinsLayer pins={pins} isPinGhost={isPinGhost} />}
          </div>
        )
      }}
    </MapStateResolver>
  )
}

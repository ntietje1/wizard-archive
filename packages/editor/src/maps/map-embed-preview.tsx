import { Image as ImageIcon, MapPin } from 'lucide-react'
import type { MapPreview } from '../resources/content-session-contract'
import type { MapPinId } from '../resources/domain-id'
import { MapImagePinLayout } from './map-image-pin-layout'
import { useMapImageUrl } from './use-map-image-url'

export function MapEmbedPreview({
  focusedPinId,
  preview,
  title,
}: {
  focusedPinId?: MapPinId | null
  preview: MapPreview
  title: string
}) {
  const focusedPin = focusedPinId
    ? preview.content.pins.find((pin) => pin.id === focusedPinId)
    : null
  const layerId = focusedPin?.layerId ?? null
  const image =
    layerId === null
      ? preview.content.image
      : (preview.content.layers.find((layer) => layer.id === layerId)?.image ??
        preview.content.image)
  const { state } = useMapImageUrl(preview, layerId, image)

  if (focusedPinId && !focusedPin) {
    return (
      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
        Target unavailable
      </div>
    )
  }

  if (state.status !== 'ready') {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center text-muted-foreground">
        <ImageIcon className="size-7" aria-hidden="true" />
        <span className="text-xs">
          {state.status === 'loading' ? 'Loading map image' : 'No map image'}
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden bg-muted/20">
      <MapImagePinLayout
        alt={title}
        pins={preview.content.pins.map((pin) =>
          pin.visible && pin.layerId === layerId ? (
            <MapPin
              key={pin.id}
              className="absolute size-5 fill-primary text-primary-foreground drop-shadow-sm data-[focused=true]:size-7 data-[focused=true]:drop-shadow-lg"
              data-focused={pin.id === focusedPinId}
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            />
          ) : null,
        )}
        src={state.url}
      />
    </div>
  )
}

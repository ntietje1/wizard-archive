import { Image as ImageIcon, MapPin } from 'lucide-react'
import type { MapSession } from '../resources/content-session-contract'
import { useMapImageUrl } from './use-map-image-url'

export function MapEmbedPreview({ session, title }: { session: MapSession; title: string }) {
  const image = session.content.image
  const { state } = useMapImageUrl(session, null, image)

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
      <img
        alt={title}
        className="block max-h-full max-w-full object-contain"
        draggable={false}
        src={state.url}
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {session.content.pins.map((pin) =>
          pin.visible && pin.layerId === null ? (
            <MapPin
              key={pin.id}
              className="absolute size-5 fill-primary text-primary-foreground drop-shadow-sm"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}

import { Image as ImageIcon, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MapImageAttachment, MapSession } from '../resources/content-session-contract'
import { beginContentObjectUrlLoad } from '../resources/content-object-url'
import type { ContentObjectUrlState } from '../resources/content-object-url'

type MapEmbedImageState = Readonly<{ status: 'empty' }> | ContentObjectUrlState

export function MapEmbedPreview({ session, title }: { session: MapSession; title: string }) {
  const image = session.content.image
  const [loaded, setLoaded] = useState<MapEmbedImageState>(() => initialMapImageState(image))

  useEffect(() => {
    if (image.status === 'unattached') {
      setLoaded({ status: 'empty' })
      return
    }
    return beginContentObjectUrlLoad(() => session.loadImage(null), setLoaded)
  }, [image, session])

  if (loaded.status !== 'ready') {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center text-muted-foreground">
        <ImageIcon className="size-7" aria-hidden="true" />
        <span className="text-xs">
          {loaded.status === 'loading' ? 'Loading map image' : 'No map image'}
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
        src={loaded.url}
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {session.content.pins
          .filter((pin) => pin.visible && pin.layerId === null)
          .map((pin) => (
            <MapPin
              key={pin.id}
              className="absolute size-5 fill-primary text-primary-foreground drop-shadow-sm"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            />
          ))}
      </div>
    </div>
  )
}

function initialMapImageState(image: MapImageAttachment): MapEmbedImageState {
  return image.status === 'attached' ? { status: 'loading' } : { status: 'empty' }
}

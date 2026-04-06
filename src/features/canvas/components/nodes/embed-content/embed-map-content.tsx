import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

export function EmbedMapContent({ imageUrl }: { imageUrl: string | null }) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  if (!imageUrl || imgError) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <ImageOff className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <img
        src={imageUrl}
        alt="Map preview"
        className="h-full w-full object-contain"
        draggable={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    </div>
  )
}

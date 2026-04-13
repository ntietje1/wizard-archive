import { useState } from 'react'
import { ImageOff } from 'lucide-react'

export function MapImagePreview({ imageUrl }: { imageUrl: string | null }) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const imgError = erroredUrl === imageUrl

  if (!imageUrl || imgError) {
    return (
      <div
        className="h-full flex items-center justify-center text-muted-foreground"
        role="img"
        aria-label="Map image not available"
      >
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
        onError={() => setErroredUrl(imageUrl)}
      />
    </div>
  )
}

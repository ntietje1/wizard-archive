import { ImageOff } from 'lucide-react'
import { PreviewImage } from '~/features/previews/components/preview-image'

export function MapImagePreview({ imageUrl }: { imageUrl: string | null }) {
  return (
    <PreviewImage
      src={imageUrl}
      alt="Map preview"
      objectFit="contain"
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
          <span className="sr-only">Map image not available</span>
        </div>
      }
    />
  )
}

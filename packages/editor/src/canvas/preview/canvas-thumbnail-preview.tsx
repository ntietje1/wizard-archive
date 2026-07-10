import { Grid2x2Plus } from 'lucide-react'
import { PreviewImage } from '../../previews/components/preview-image'

export function CanvasThumbnailPreview({
  previewUrl,
  alt,
  objectFit = 'contain',
}: {
  previewUrl: string | null
  alt: string
  objectFit?: 'contain' | 'cover'
}) {
  return (
    <PreviewImage
      src={previewUrl}
      alt={alt}
      objectFit={objectFit}
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Grid2x2Plus className="h-6 w-6" aria-hidden />
          <span className="sr-only">Canvas preview unavailable</span>
        </div>
      }
    />
  )
}

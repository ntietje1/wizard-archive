import { Grid2x2Plus } from 'lucide-react'
import { PreviewImage } from './preview-image'

export function CanvasThumbnailPreview({
  previewUrl,
  alt,
}: {
  previewUrl: string | null
  alt: string
}) {
  return (
    <PreviewImage
      src={previewUrl}
      alt={alt}
      objectFit="contain"
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Grid2x2Plus className="h-6 w-6" aria-hidden />
          <span className="sr-only">Canvas preview unavailable</span>
        </div>
      }
    />
  )
}

import { useState } from 'react'
import { File, FileAudio, FileText, FileVideo } from 'lucide-react'
import { PreviewImage } from '~/features/previews/components/preview-image'
import { resolveFilePreviewImageUrl } from './file-preview-source'

export function FilePreview({
  downloadUrl,
  contentType,
  previewUrl,
  alt,
}: {
  downloadUrl: string | null
  contentType: string | null
  previewUrl: string | null
  alt?: string
}) {
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(() => new Set())

  const markErrored = (url: string) => {
    setErroredUrls((prev) => new Set(prev).add(url))
  }

  if (!downloadUrl) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <File className="h-6 w-6" aria-hidden />
        <span className="sr-only">File preview unavailable</span>
      </div>
    )
  }

  const previewImageUrl = resolveFilePreviewImageUrl({
    downloadUrl,
    contentType,
    previewUrl,
    erroredUrls,
  })

  if (previewImageUrl) {
    return (
      <PreviewImage
        src={previewImageUrl}
        alt={alt ?? 'File preview'}
        showLoadingIndicator={true}
        fallback={null}
        onError={() => markErrored(previewImageUrl)}
      />
    )
  }

  const Icon = getFileTypeIcon(contentType)

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <Icon className="h-6 w-6" aria-hidden />
      <span className="sr-only">File preview unavailable</span>
    </div>
  )
}

function getFileTypeIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return FileVideo
  if (contentType?.startsWith('audio/')) return FileAudio
  if (contentType === 'application/pdf') return FileText
  return File
}

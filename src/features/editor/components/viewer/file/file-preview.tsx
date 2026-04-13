import { useState } from 'react'
import { File, FileAudio, FileText, FileVideo } from 'lucide-react'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

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
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)

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

  if (contentType?.startsWith('image/') && !erroredUrls.has(downloadUrl)) {
    return (
      <ImageWithLoader
        src={downloadUrl}
        alt={alt ?? 'Embedded image'}
        isLoading={loadedUrl !== downloadUrl}
        onLoad={() => setLoadedUrl(downloadUrl)}
        onError={() => markErrored(downloadUrl)}
      />
    )
  }

  if (previewUrl && !erroredUrls.has(previewUrl)) {
    return (
      <ImageWithLoader
        src={previewUrl}
        alt={alt ?? 'File preview'}
        isLoading={loadedUrl !== previewUrl}
        onLoad={() => setLoadedUrl(previewUrl)}
        onError={() => markErrored(previewUrl)}
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

function ImageWithLoader({
  src,
  alt,
  isLoading,
  onLoad,
  onError,
}: {
  src: string
  alt: string
  isLoading: boolean
  onLoad: () => void
  onError: () => void
}) {
  return (
    <div className="h-full w-full overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-contain transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  )
}

function getFileTypeIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return FileVideo
  if (contentType?.startsWith('audio/')) return FileAudio
  if (contentType === 'application/pdf') return FileText
  return File
}

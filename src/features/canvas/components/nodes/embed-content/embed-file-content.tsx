import { useEffect, useState } from 'react'
import { File, FileAudio, FileText, FileVideo } from 'lucide-react'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

export function EmbedFileContent({
  downloadUrl,
  contentType,
  alt,
}: {
  downloadUrl: string | null
  contentType: string | null
  alt?: string
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)

  useEffect(() => {
    setImgError(false)
    setImgLoading(true)
  }, [downloadUrl])

  if (!downloadUrl) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <File className="h-6 w-6" />
      </div>
    )
  }

  if (contentType?.startsWith('image/') && !imgError) {
    return (
      <div className="h-full w-full overflow-hidden relative">
        {imgLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size="sm" />
          </div>
        )}
        <img
          src={downloadUrl}
          alt={alt ?? 'Embedded image'}
          className={`h-full w-full object-contain transition-opacity ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
          draggable={false}
          onLoad={() => setImgLoading(false)}
          onError={() => {
            setImgLoading(false)
            setImgError(true)
          }}
        />
      </div>
    )
  }

  const Icon = getFileTypeIcon(contentType)

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
      <Icon className="h-6 w-6" />
    </div>
  )
}

function getFileTypeIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return FileVideo
  if (contentType?.startsWith('audio/')) return FileAudio
  if (contentType === 'application/pdf') return FileText
  return File
}

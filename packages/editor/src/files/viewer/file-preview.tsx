import { useState } from 'react'
import { File, FileAudio, FileImage, FileText, FileVideo } from 'lucide-react'
import { PreviewImage } from '../../previews/components/preview-image'
import { resolveFilePreviewImageUrl } from './file-preview-url'
import { getFileTypeCategory } from '../file-type-category'

export function FilePreview({
  downloadUrl,
  contentType,
  fileName,
  previewUrl,
  alt,
}: {
  downloadUrl: string | null
  contentType: string | null
  fileName?: string | null
  previewUrl: string | null
  alt?: string
}) {
  const fileKey = `${contentType ?? ''}\n${downloadUrl ?? ''}\n${fileName ?? ''}\n${previewUrl ?? ''}`
  return (
    <FilePreviewContent
      key={fileKey}
      alt={alt}
      contentType={contentType}
      downloadUrl={downloadUrl}
      fileName={fileName}
      previewUrl={previewUrl}
    />
  )
}

function FilePreviewContent({
  downloadUrl,
  contentType,
  fileName,
  previewUrl,
  alt,
}: {
  downloadUrl: string | null
  contentType: string | null
  fileName?: string | null
  previewUrl: string | null
  alt?: string
}) {
  const [erroredUrls, setErroredUrls] = useState(() => new Set<string>())

  const markErrored = (url: string) => {
    setErroredUrls((current) => new Set(current).add(url))
  }

  const previewImageUrl = resolveFilePreviewImageUrl({
    downloadUrl,
    contentType,
    fileName,
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

  const Icon = getFileTypeIcon(contentType, fileName ?? null)

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      <Icon className="h-6 w-6" aria-hidden />
      <span className="sr-only">File preview unavailable</span>
    </div>
  )
}

function getFileTypeIcon(contentType: string | null, fileName: string | null) {
  switch (getFileTypeCategory(contentType, fileName)) {
    case 'video':
      return FileVideo
    case 'audio':
      return FileAudio
    case 'pdf':
      return FileText
    case 'image':
      return FileImage
    default:
      return File
  }
}

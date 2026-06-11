import { ClientOnly } from '@tanstack/react-router'
import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import { assertNever } from '~/shared/utils/utils'

const pdfFallback = (
  <div className="flex h-full w-full items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
)

type FileType = 'image' | 'pdf' | 'video' | 'audio' | 'other'

function getFileType(contentType: string | null | undefined): FileType {
  if (!contentType) {
    return 'other'
  }
  const mimeType = contentType.toLowerCase()
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType === 'application/pdf') {
    return 'pdf'
  }
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio'
  }
  return 'other'
}

export function FileContentViewer({
  allowObjectUrl = false,
  contentType,
  downloadUrl,
  name,
}: {
  allowObjectUrl?: boolean
  contentType: string | null | undefined
  downloadUrl: string
  name: string | null | undefined
}) {
  const fileType = getFileType(contentType)
  const fileName = name || 'File'

  switch (fileType) {
    case 'image':
      return (
        <ImageFileViewer imageUrl={downloadUrl} alt={fileName} allowObjectUrl={allowObjectUrl} />
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <PdfFileViewer pdfUrl={downloadUrl} allowObjectUrl={allowObjectUrl} />
        </ClientOnly>
      )
    case 'video':
      return <VideoFileViewer videoUrl={downloadUrl} allowObjectUrl={allowObjectUrl} />
    case 'audio':
      return <AudioFileViewer audioUrl={downloadUrl} allowObjectUrl={allowObjectUrl} />
    case 'other':
      return (
        <OtherFileViewer
          fileUrl={downloadUrl}
          fileName={fileName}
          allowObjectUrl={allowObjectUrl}
        />
      )
    default:
      return assertNever(fileType)
  }
}

import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import { getFileTypeCategory } from '../file-type-category'

const pdfFallback = (
  <div className="flex h-full w-full items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
)

export function FileContentViewer({
  allowDataUrl = false,
  allowObjectUrl = false,
  contentType,
  downloadUrl,
  name,
}: {
  allowDataUrl?: boolean
  allowObjectUrl?: boolean
  contentType: string | null | undefined
  downloadUrl: string
  name: string | null | undefined
}) {
  const fileType = getFileTypeCategory(contentType, name)
  const fileName = name || 'File'

  switch (fileType) {
    case 'image':
      return (
        <ImageFileViewer
          imageUrl={downloadUrl}
          alt={fileName}
          allowDataUrl={allowDataUrl}
          allowObjectUrl={allowObjectUrl}
        />
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <PdfFileViewer
            pdfUrl={downloadUrl}
            allowDataUrl={allowDataUrl}
            allowObjectUrl={allowObjectUrl}
          />
        </ClientOnly>
      )
    case 'video':
      return (
        <VideoFileViewer
          videoUrl={downloadUrl}
          allowDataUrl={allowDataUrl}
          allowObjectUrl={allowObjectUrl}
        />
      )
    case 'audio':
      return (
        <AudioFileViewer
          audioUrl={downloadUrl}
          allowDataUrl={allowDataUrl}
          allowObjectUrl={allowObjectUrl}
        />
      )
    case 'file':
      return (
        <OtherFileViewer
          fileUrl={downloadUrl}
          fileName={fileName}
          allowDataUrl={allowDataUrl}
          allowObjectUrl={allowObjectUrl}
        />
      )
    default:
      return assertNever(fileType)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled file type: ${String(value)}`)
}

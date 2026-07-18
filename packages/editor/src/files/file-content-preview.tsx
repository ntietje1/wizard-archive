import { File as FileIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { FileResourceContent } from '../resources/content-session-contract'
import { FILE_CLASSIFICATION } from '../resources/file-content-contract'
import { ImageFileViewer } from './image-file-viewer'
import { MediaFileViewer } from './media-file-viewer'

const PdfFileViewer = lazy(() =>
  import('./pdf-file-viewer').then(({ PdfFileViewer: Viewer }) => ({ default: Viewer })),
)

export function FileContentPreview({
  content,
  fileName,
  url,
}: {
  content: FileResourceContent
  fileName: string
  url: string
}) {
  switch (content.classification) {
    case FILE_CLASSIFICATION.image:
      return <ImageFileViewer alt={fileName} url={url} />
    case FILE_CLASSIFICATION.pdf:
      return (
        <Suspense fallback={<FilePreviewState title="Loading PDF…" />}>
          <PdfFileViewer url={url} />
        </Suspense>
      )
    case FILE_CLASSIFICATION.audio:
      return <MediaFileViewer kind="audio" url={url} />
    case FILE_CLASSIFICATION.video:
      return <MediaFileViewer kind="video" url={url} />
    case FILE_CLASSIFICATION.inert:
      return (
        <FilePreviewState
          title={fileName}
          description={fileUnavailableDescription(content.viewerUnavailableReason)}
        />
      )
  }
}

export function FilePreviewState({
  action,
  compact = false,
  description,
  title,
}: {
  action?: ReactNode
  compact?: boolean
  description?: string
  title: string
}) {
  return (
    <div
      className={`flex size-full items-center justify-center text-center ${
        compact ? 'min-h-0 p-3' : 'min-h-72 p-6'
      }`}
    >
      <div className="flex max-w-md flex-col items-center">
        <FileIcon
          className={`${compact ? 'mb-2 size-6' : 'mb-3 size-9'} text-muted-foreground`}
          aria-hidden="true"
        />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  )
}

function fileUnavailableDescription(
  reason: FileResourceContent['viewerUnavailableReason'],
): string {
  switch (reason) {
    case 'empty_file':
      return 'This file is empty.'
    case 'note_size_limit':
      return 'This file is too large or complex to preview.'
    case 'invalid_utf8':
    case 'nul_byte':
    case 'unsupported_format':
    case null:
      return 'This file type cannot be previewed.'
  }
}

import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import type { FileWithContent } from 'convex/files/types'
import type { EditorViewerProps } from '../sidebar-item-editor'

function getFileType(
  contentType: string | null | undefined,
): 'image' | 'pdf' | 'video' | 'audio' | 'other' {
  if (!contentType) {
    return 'other'
  }
  const mimeType = contentType.toLowerCase()
  if (mimeType.startsWith('image/')) {
    return 'image'
  } else if (mimeType === 'application/pdf') {
    return 'pdf'
  } else if (mimeType.startsWith('video/')) {
    return 'video'
  } else if (mimeType.startsWith('audio/')) {
    return 'audio'
  } else {
    return 'other'
  }
}

export function FileViewer({ item: file }: EditorViewerProps<FileWithContent>) {
  if (!file.downloadUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">File not found</p>
          <p className="text-sm mt-2">{file.name || 'Untitled File'}</p>
        </div>
      </div>
    )
  }

  const fileType = getFileType(file.contentType)

  switch (fileType) {
    case 'image':
      return (
        <ImageFileViewer
          imageUrl={file.downloadUrl}
          alt={file.name || 'File'}
        />
      )
    case 'pdf':
      return (
        <PdfFileViewer
          pdfUrl={file.downloadUrl}
          title={file.name || 'PDF Document'}
        />
      )
    case 'video':
      return <VideoFileViewer videoUrl={file.downloadUrl} />
    case 'audio':
      return <AudioFileViewer audioUrl={file.downloadUrl} />
    case 'other':
    default:
      return (
        <OtherFileViewer
          fileUrl={file.downloadUrl}
          fileName={file.name || 'File'}
        />
      )
  }
}

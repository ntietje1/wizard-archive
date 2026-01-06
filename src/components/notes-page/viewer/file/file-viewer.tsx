import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery, useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import type { File } from 'convex/files/types'
import type { EditorViewerProps } from '../sidebar-item-editor'
import { LoadingSpinner } from '~/components/loading/loading-spinner'

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

export function FileViewer({ item: file }: EditorViewerProps<File>) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const convex = useConvex()

  const metadataQuery = useQuery(
    convexQuery(
      api.storage.queries.getStorageMetadata,
      file.storageId ? { storageId: file.storageId } : 'skip',
    ),
  )

  useEffect(() => {
    if (!file.storageId) {
      setError('No file storage ID')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    convex
      .query(api.storage.queries.getDownloadUrl, {
        storageId: file.storageId,
      })
      .then((url) => {
        setFileUrl(url || null)
        setIsLoading(false)
        if (!url) {
          setError('Failed to load file URL')
        }
      })
      .catch((err) => {
        console.error('Failed to load file:', err)
        setError('Failed to load file')
        setIsLoading(false)
      })
  }, [file.storageId, convex])

  if (isLoading || metadataQuery.isPending) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !fileUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">{error || 'File not found'}</p>
          <p className="text-sm mt-2">{file.name || 'Untitled File'}</p>
        </div>
      </div>
    )
  }

  const contentType = metadataQuery.data?.contentType ?? null
  const fileType = getFileType(contentType)

  switch (fileType) {
    case 'image':
      return <ImageFileViewer imageUrl={fileUrl} alt={file.name || 'File'} />
    case 'pdf':
      return (
        <PdfFileViewer pdfUrl={fileUrl} title={file.name || 'PDF Document'} />
      )
    case 'video':
      return <VideoFileViewer videoUrl={fileUrl} />
    case 'audio':
      return <AudioFileViewer audioUrl={fileUrl} />
    case 'other':
    default:
      return (
        <OtherFileViewer fileUrl={fileUrl} fileName={file.name || 'File'} />
      )
  }
}

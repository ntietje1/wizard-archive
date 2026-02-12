import { useCallback } from 'react'
import { toast } from 'sonner'
import { File } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import type { FileWithContent } from 'convex/files/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import { useFileWithPreview } from '~/hooks/useFileWithPreview'
import { FileUploadSection } from '~/components/file-upload/file-upload-section'
import { validateFileForUpload } from '~/lib/file-validation'

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

function FileUpload({ fileId }: { fileId: Id<'files'> }) {
  const updateFile = useMutation({
    mutationFn: useConvexMutation(api.files.mutations.updateFile),
  })

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
    onUploadComplete: async (storageId) => {
      try {
        await updateFile.mutateAsync({ fileId, storageId })
        toast.success('File uploaded')
      } catch {
        toast.error('Failed to attach file. Please try again.')
      }
    },
  })

  const handleFileSelected = useCallback(
    (file: globalThis.File) => {
      fileUpload.handleFileSelect(file)
    },
    [fileUpload],
  )

  return (
    <div
      className="w-full h-full flex items-center justify-center p-8"
      onDragEnter={fileUpload.handleDrag}
      onDragLeave={fileUpload.handleDrag}
      onDragOver={fileUpload.handleDrag}
      onDrop={fileUpload.handleDrop}
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <File className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-medium">Upload File</h2>
          <p className="text-sm text-muted-foreground">
            Upload a file to add it to your campaign.
          </p>
        </div>

        <div className="space-y-4">
          <FileUploadSection
            fileUpload={fileUpload}
            handleFileSelect={handleFileSelected}
            isSubmitting={false}
            acceptPattern="*"
            dragDropText="Drag a file here or click to browse"
          />

          {fileUpload.uploadError && (
            <p className="text-sm text-destructive text-center">
              {fileUpload.uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function FileViewer({ item: file }: EditorViewerProps<FileWithContent>) {
  if (!file.downloadUrl) {
    return <FileUpload fileId={file._id} />
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

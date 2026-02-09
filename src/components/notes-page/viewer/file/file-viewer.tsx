import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { File } from 'lucide-react'
import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import type { FileWithContent } from 'convex/files/types'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorViewerProps } from '../sidebar-item-editor'
import { useFileActions } from '~/hooks/useFileActions'
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
  const { updateFile } = useFileActions()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
  })

  const handleFileSelected = useCallback(
    (file: globalThis.File) => {
      fileUpload.handleFileSelect(file)
    },
    [fileUpload],
  )

  const handleUploadComplete = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const storageId = await fileUpload.handleSubmit()
      await updateFile.mutateAsync({
        fileId,
        storageId,
      })
      toast.success('File uploaded')
    } catch (error) {
      console.error(error)
      toast.error('Failed to upload file')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, fileUpload, updateFile, fileId])

  const hasUploadedFile =
    fileUpload.file && !fileUpload.isUploading && !fileUpload.uploadError

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
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
            isSubmitting={isSubmitting}
            acceptPattern="*"
            dragDropText="Drag a file here or click to browse"
          />

          {fileUpload.uploadError && (
            <p className="text-sm text-destructive text-center">
              {fileUpload.uploadError}
            </p>
          )}

          {hasUploadedFile && !isSubmitting && (
            <button
              type="button"
              onClick={handleUploadComplete}
              className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Attach File
            </button>
          )}

          {isSubmitting && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
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

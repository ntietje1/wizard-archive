import { ClientOnly } from '@tanstack/react-router'
import { toast } from 'sonner'
import { File } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { FILE_UPLOAD_ACCEPT_PATTERN, validateFileForUpload } from 'shared/storage/validation'
import { AudioFileViewer } from './audio-file-viewer'
import { ImageFileViewer } from './image-file-viewer'
import { OtherFileViewer } from './other-file-viewer'
import { VideoFileViewer } from './video-file-viewer'
import { PdfFileViewer } from './pdf-file-viewer'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { Id } from 'convex/_generated/dataModel'
import type { FileWithContent } from 'shared/files/types'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { FileUploadEmptyState } from '~/features/file-upload/components/file-upload-empty-state'
import { assertNever } from '~/shared/utils/utils'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

const pdfFallback = (
  <div className="flex items-center justify-center w-full h-full">
    <LoadingSpinner size="lg" />
  </div>
)

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

function FileUpload({ fileId }: { fileId: Id<'sidebarItems'> }) {
  const updateFileStorage = useCampaignMutation(api.files.mutations.updateFileStorage)

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
    onUploadComplete: async (storageId) => {
      try {
        await updateFileStorage.mutateAsync({ fileId, storageId })
        toast.success('File uploaded')
      } catch (error) {
        handleError(error, 'Failed to attach file')
      }
    },
  })

  return (
    <FileUploadEmptyState
      fileUpload={fileUpload}
      icon={File}
      title="Upload File"
      description="Upload a file to add it to your campaign."
      isSubmitting={fileUpload.isUploading || updateFileStorage.isPending}
      acceptPattern={FILE_UPLOAD_ACCEPT_PATTERN}
      dragDropText="Drag a file here or click to browse"
    />
  )
}

export function FileViewer({ item: file }: ViewerProps<FileWithContent>) {
  if (!file.downloadUrl) {
    return <FileUpload fileId={file._id} />
  }

  const fileType = getFileType(file.contentType)

  switch (fileType) {
    case 'image':
      return (
        <ImageFileViewer key={file._id} imageUrl={file.downloadUrl} alt={file.name || 'File'} />
      )
    case 'pdf':
      return (
        <ClientOnly fallback={pdfFallback}>
          <PdfFileViewer key={file.downloadUrl} pdfUrl={file.downloadUrl} />
        </ClientOnly>
      )
    case 'video':
      return <VideoFileViewer videoUrl={file.downloadUrl} />
    case 'audio':
      return <AudioFileViewer audioUrl={file.downloadUrl} />
    case 'other':
      return <OtherFileViewer fileUrl={file.downloadUrl} fileName={file.name || 'File'} />
    default:
      return assertNever(fileType)
  }
}

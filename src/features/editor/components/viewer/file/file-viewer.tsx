import { toast } from 'sonner'
import { File } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { FILE_UPLOAD_ACCEPT_PATTERN, validateFileForUpload } from 'shared/storage/validation'
import { FileContentViewer } from './file-content-viewer'
import type { ViewerProps } from '~/shared/viewer/viewer-props'
import type { Id } from 'convex/_generated/dataModel'
import type { FileWithContent } from 'shared/files/types'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { FileUploadEmptyState } from '~/features/file-upload/components/file-upload-empty-state'
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

  return (
    <FileContentViewer
      key={file.downloadUrl}
      downloadUrl={file.downloadUrl}
      contentType={file.contentType}
      name={file.name}
    />
  )
}

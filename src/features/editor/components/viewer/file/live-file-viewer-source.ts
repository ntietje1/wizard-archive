import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { validateFileForUpload } from 'shared/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'
import type { FileViewerSource } from './file-viewer-source'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export function useLiveFileViewerSource(
  contentItem: AnySidebarItemWithContent | null,
): FileViewerSource {
  const updateFileStorage = useCampaignMutation(api.files.mutations.updateFileStorage)
  const uploadTarget =
    contentItem?.type === SIDEBAR_ITEM_TYPES.files && !contentItem.downloadUrl ? contentItem : null
  const fileUpload = useFileWithPreview({
    isOpen: Boolean(uploadTarget),
    uploadOnSelect: true,
    fileTypeValidator: validateFileForUpload,
    onUploadComplete: async (storageId) => {
      if (!uploadTarget) return

      try {
        await updateFileStorage.mutateAsync({ fileId: uploadTarget._id, storageId })
        toast.success('File uploaded')
      } catch (error) {
        handleError(error, 'Failed to attach file')
      }
    },
  })

  const source: FileViewerSource = {
    getEmptyFileUpload: (file) =>
      uploadTarget?._id === file._id
        ? {
            fileUpload,
            isSubmitting: fileUpload.isUploading || updateFileStorage.isPending,
          }
        : null,
    resolveFile: (file) => ({
      allowObjectUrl: false,
      contentType: file.contentType,
      downloadUrl: file.downloadUrl,
      name: file.name,
      size: null,
    }),
  }

  return source
}

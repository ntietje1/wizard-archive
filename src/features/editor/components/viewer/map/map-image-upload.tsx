import { api } from 'convex/_generated/api'
import { Image } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploadEmptyState } from '~/features/file-upload/components/file-upload-empty-state'
import { useFileWithPreview } from '~/features/file-upload/hooks/useFileWithPreview'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { handleError } from '~/shared/utils/logger'
import type { Id } from 'convex/_generated/dataModel'

export function MapImageUpload({ mapId }: { mapId: Id<'sidebarItems'> }) {
  const updateMapImage = useCampaignMutation(api.gameMaps.mutations.updateMapImage)

  const fileUpload = useFileWithPreview({
    isOpen: true,
    uploadOnSelect: true,
    fileTypeValidator: (file: globalThis.File) => {
      if (!file.type.startsWith('image/')) {
        return {
          valid: false,
          error: 'Only image files are allowed for maps',
        }
      }
      return { valid: true }
    },
    onUploadComplete: async (storageId) => {
      try {
        await updateMapImage.mutateAsync({
          mapId,
          imageStorageId: storageId,
        })
        toast.success('Map image uploaded')
      } catch (error) {
        handleError(error, 'Failed to update map')
      }
    },
  })

  return (
    <FileUploadEmptyState
      fileUpload={fileUpload}
      icon={Image}
      title="Upload Map Image"
      description="Upload an image to create your map. You can pin items to it later."
      isSubmitting={false}
      acceptPattern="image/*"
      dragDropText="Drag an image here or click to browse"
    />
  )
}

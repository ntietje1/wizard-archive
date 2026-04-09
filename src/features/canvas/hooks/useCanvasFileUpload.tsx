import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { isMediaFile, isTextFile, validateFileForUpload } from 'convex/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { convertTextToBlocks } from '~/features/editor/utils/text-to-blocks'
import { getErrorMessage, uploadFile } from '~/features/file-upload/utils/file-upload'
import { ToastContent } from '~/features/file-upload/components/file-progress-toasts'

const TOAST_STYLE = { width: '100%', maxWidth: '100%' } as const

export function useCanvasFileUpload() {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateSidebarItem()

  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload)
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)

  const uploadFileToSidebar = async (file: File): Promise<{ id: SidebarItemId } | null> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return null
    }

    const validation = validateFileForUpload(file)
    if (!validation.valid) {
      toast.error(`${file.name}: ${validation.error}`)
      return null
    }

    const toastId = toast.loading(
      <ToastContent
        title={file.name}
        message={isTextFile(file.type, file.name) ? 'Processing...' : 'Uploading... 0%'}
        progress={isTextFile(file.type, file.name) ? undefined : 0}
      />,
      { duration: Infinity, style: TOAST_STYLE },
    )

    try {
      if (isTextFile(file.type, file.name)) {
        const blocks = await convertTextToBlocks(file)
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.notes,
          campaignId,
          name: file.name,
          parentId: null,
          content: blocks,
        })
        toast.dismiss(toastId)
        toast.success(<ToastContent title={file.name} message="Note created" />, {
          duration: 3000,
          style: TOAST_STYLE,
        })
        return { id: result.id }
      }

      if (isMediaFile(file.type)) {
        const uploadUrl = await generateUploadUrl.mutateAsync({})
        const storageId = await uploadFile(file, uploadUrl, {
          onProgress: (pct) => {
            toast.loading(
              <ToastContent title={file.name} message={`Uploading... ${pct}%`} progress={pct} />,
              { id: toastId, duration: Infinity, style: TOAST_STYLE },
            )
          },
        })
        await trackUpload.mutateAsync({
          storageId,
          originalFileName: file.name,
        })
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.files,
          campaignId,
          name: file.name,
          storageId,
          parentId: null,
        })
        await commitUpload.mutateAsync({ storageId })
        toast.dismiss(toastId)
        toast.success(<ToastContent title={file.name} message="File created" />, {
          duration: 3000,
          style: TOAST_STYLE,
        })
        return { id: result.id }
      }

      toast.dismiss(toastId)
      toast.error(`${file.name}: unsupported file type`)
      return null
    } catch (error) {
      toast.dismiss(toastId)
      toast.error(<ToastContent title={file.name} message={getErrorMessage(error)} />, {
        duration: 5000,
        style: TOAST_STYLE,
      })
      return null
    }
  }

  return { uploadFileToSidebar }
}

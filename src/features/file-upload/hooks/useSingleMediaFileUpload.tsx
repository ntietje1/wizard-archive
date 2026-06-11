import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { isMediaFile } from 'shared/storage/validation'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCreateFile } from '~/features/files/hooks/useCreateFile'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { usePdfPreviewUpload } from '~/features/previews/hooks/use-pdf-preview-upload'
import { logger } from '~/shared/utils/logger'
import { uploadFile } from '~/features/file-upload/utils/file-upload'
import { ToastContent } from '~/features/file-upload/components/file-progress-toasts'
import { prepareSingleFileUpload } from '~/features/file-upload/utils/single-file-upload-preflight'
import {
  showSingleFileUploadErrorToast,
  showUploadProgressToast,
  UPLOAD_TOAST_STYLE,
} from '~/features/file-upload/utils/upload-toast'

interface UploadSingleMediaFileOptions {
  silent?: boolean
  navigate?: boolean
  onProgress?: (percentage: number) => void
}

interface UploadSingleMediaFileResult {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
}

function startSingleMediaFileToast(fileName: string, silent: boolean): string | number | undefined {
  if (silent) return undefined
  return toast.loading(<ToastContent title={fileName} message="Uploading... 0%" progress={0} />, {
    duration: Infinity,
    style: UPLOAD_TOAST_STYLE,
  })
}

export function useSingleMediaFileUpload() {
  const { campaignId } = useCampaign()
  const { createFile } = useCreateFile()
  const {
    commands: { openParentFolders },
  } = useSidebarWorkspaceSource()
  const { navigateToItem } = useEditorNavigation()
  const { getSiblings } = useSidebarValidation()
  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload)
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)
  const { generatePdfPreviewIfNeeded } = usePdfPreviewUpload()

  const uploadSingleMediaFile = async (
    file: File,
    parentId: Id<'sidebarItems'> | null,
    { silent = false, navigate = true, onProgress }: UploadSingleMediaFileOptions = {},
  ): Promise<UploadSingleMediaFileResult | null> => {
    const preflight = prepareSingleFileUpload({ campaignId, file, getSiblings, parentId, silent })
    if (!preflight) return null
    const { fileName } = preflight

    if (!isMediaFile(file.type)) {
      if (silent) {
        logger.warn(`${fileName}: unsupported file type`)
      }
      return null
    }

    const toastId = startSingleMediaFileToast(fileName, silent)

    try {
      const uploadUrl = await generateUploadUrl.mutateAsync({})
      const storageId = await uploadFile(file, uploadUrl, {
        onProgress: (pct) => {
          onProgress?.(pct)
          if (toastId) {
            showUploadProgressToast({ fileName, percentage: pct, toastId })
          }
        },
      })

      await trackUpload.mutateAsync({
        storageId,
        originalFileName: file.name,
      })
      await commitUpload.mutateAsync({ storageId })
      const result = await createFile({
        name: fileName,
        parentTarget: { kind: 'direct', parentId },
        storageId,
      })

      void generatePdfPreviewIfNeeded(file, result.id)

      if (!silent) {
        toast.dismiss(toastId)
        toast.success(<ToastContent title={fileName} message="File created" />, {
          duration: 3000,
          style: UPLOAD_TOAST_STYLE,
        })
      }
      if (navigate) {
        openParentFolders(result.id)
        void navigateToItem(result.slug, false)
      }

      return result
    } catch (error) {
      if (!silent && toastId) {
        showSingleFileUploadErrorToast({ error, fileName, toastId })
      }
      throw error
    }
  }

  return { uploadSingleMediaFile }
}

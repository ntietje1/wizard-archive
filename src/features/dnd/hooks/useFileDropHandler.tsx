import { useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { isMediaFile, isTextFile, validateFileForUpload } from 'convex/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { deduplicateName } from 'convex/sidebarItems/functions/defaultItemName'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult, FolderStructure } from '~/features/file-upload/utils/folder-reader'
import { logger } from '~/shared/utils/logger'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { convertTextToBlocks } from '~/features/editor/utils/text-to-blocks'
import {
  FileProgressContent,
  FolderProgressContent,
  ToastContent,
} from '~/features/file-upload/components/file-progress-toasts'
import { getDropResultStats } from '~/features/file-upload/utils/folder-reader'
import { getErrorMessage, uploadFile } from '~/features/file-upload/utils/file-upload'
import { usePdfPreviewUpload } from '~/features/previews/hooks/use-pdf-preview-upload'

interface DropOptions {
  parentId: Id<'sidebarItems'> | null
}

interface UploadSingleFileOptions {
  silent?: boolean
  navigate?: boolean
}

export interface UploadSingleFileResult {
  id: Id<'sidebarItems'>
  slug: string
}

export interface UploadProgress {
  toastId: string | number
  totalFiles: number
  totalFolders: number
  processedFiles: number
  processedFolders: number
  skippedFiles: number
}

const TOAST_STYLE = { width: '100%', maxWidth: '100%' } as const

export function useFileDropHandler() {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateSidebarItem()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()
  const { getSiblings } = useSidebarValidation()

  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload)
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)
  const { generatePdfPreviewIfNeeded } = usePdfPreviewUpload()

  const activeUploadsRef = useRef<Map<string, { toastId: string | number }>>(new Map())

  const uploadSingleFile = async (
    file: File,
    parentId: Id<'sidebarItems'> | null,
    { silent = false, navigate = true }: UploadSingleFileOptions = {},
  ): Promise<UploadSingleFileResult | null> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return null
    }

    const siblingNames = getSiblings(parentId).map((s) => s.name)
    const fileName = deduplicateName(file.name, siblingNames)
    const uploadId = crypto.randomUUID()
    const validation = validateFileForUpload(file)
    if (!validation.valid) {
      if (!silent) toast.error(`${fileName}: ${validation.error}`)
      return null
    }

    let toastId: string | number | undefined
    if (!silent) {
      toastId = toast.loading(
        <ToastContent
          title={fileName}
          message={isTextFile(file.type, file.name) ? 'Processing...' : 'Uploading... 0%'}
          progress={isTextFile(file.type, file.name) ? undefined : 0}
        />,
        { duration: Infinity, style: TOAST_STYLE },
      )
      activeUploadsRef.current.set(uploadId, { toastId })
    }

    try {
      let result: UploadSingleFileResult

      if (isTextFile(file.type, file.name)) {
        const blocks = await convertTextToBlocks(file)
        result = await createItem({
          type: SIDEBAR_ITEM_TYPES.notes,
          campaignId,
          name: fileName,
          parentTarget: { kind: 'direct', parentId },
          content: blocks,
        })

        if (!silent) {
          toast.dismiss(toastId)
          toast.success(<ToastContent title={fileName} message="Note created" />, {
            duration: 3000,
            style: TOAST_STYLE,
          })
        }
      } else if (isMediaFile(file.type)) {
        const uploadUrl = await generateUploadUrl.mutateAsync({})
        const storageId = await uploadFile(file, uploadUrl, {
          onProgress: silent
            ? undefined
            : (pct) => {
                if (toastId) {
                  toast.loading(
                    <ToastContent
                      title={fileName}
                      message={`Uploading... ${pct}%`}
                      progress={pct}
                    />,
                    {
                      id: toastId,
                      duration: Infinity,
                      style: TOAST_STYLE,
                    },
                  )
                }
              },
        })

        await trackUpload.mutateAsync({
          storageId,
          originalFileName: file.name,
        })
        await commitUpload.mutateAsync({ storageId })
        result = await createItem({
          type: SIDEBAR_ITEM_TYPES.files,
          campaignId,
          name: fileName,
          storageId,
          parentTarget: { kind: 'direct', parentId },
        })

        generatePdfPreviewIfNeeded(file, result.id as Id<'sidebarItems'>).catch((err: unknown) =>
          logger.error('PDF preview generation failed', err),
        )

        if (!silent) {
          toast.dismiss(toastId)
          toast.success(<ToastContent title={fileName} message="File created" />, {
            duration: 3000,
            style: TOAST_STYLE,
          })
        }
      } else {
        if (silent) {
          logger.warn(`${fileName}: unsupported file type`)
        }
        return null
      }

      if (!silent) activeUploadsRef.current.delete(uploadId)
      if (navigate) {
        openParentFolders(result.id)
        void navigateToItem(result.slug, isTextFile(file.type, file.name))
      }
      return result
    } catch (error) {
      if (!silent) activeUploadsRef.current.delete(uploadId)
      if (!silent && toastId) {
        toast.dismiss(toastId)
        toast.error(<ToastContent title={fileName} message={getErrorMessage(error)} />, {
          duration: 5000,
          style: TOAST_STYLE,
        })
      }
      throw error
    }
  }

  const uploadFolderRecursive = async (
    folder: FolderStructure,
    parentId: Id<'sidebarItems'> | null,
    progress: UploadProgress,
  ): Promise<Id<'sidebarItems'>> => {
    if (!campaignId) {
      throw new Error('Campaign data missing')
    }
    const result = await createItem({
      type: SIDEBAR_ITEM_TYPES.folders,
      campaignId,
      name: folder.name,
      parentTarget: { kind: 'direct', parentId },
    })
    const folderId = result.id as Id<'sidebarItems'>

    progress.processedFolders++
    toast.loading(<FolderProgressContent progress={{ ...progress }} />, {
      id: progress.toastId,
      duration: Infinity,
      style: TOAST_STYLE,
    })

    for (const { file } of folder.files) {
      try {
        const validation = validateFileForUpload(file)
        const res = await uploadSingleFile(file, folderId, {
          silent: true,
          navigate: false,
        })
        if (!res && validation.valid) {
          logger.warn(`${file.name}: unsupported file type`)
        }
        if (res) {
          progress.processedFiles++
        } else {
          progress.skippedFiles++
        }
      } catch (error) {
        logger.error(error)
        progress.skippedFiles++
      }
      toast.loading(<FolderProgressContent progress={{ ...progress }} />, {
        id: progress.toastId,
        duration: Infinity,
        style: TOAST_STYLE,
      })
    }

    for (const subfolder of folder.subfolders) {
      await uploadFolderRecursive(subfolder, folderId, progress)
    }

    return folderId
  }

  const handleDrop = async (dropResult: DropResult, options?: DropOptions): Promise<void> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return
    }

    const { files, rootFolders } = dropResult
    const hasFolders = rootFolders.length > 0
    const isSingleFile = files.length === 1 && !hasFolders

    // Single file: individual toast with navigation
    if (isSingleFile) {
      // uploadSingleFile handles all toasts when silent=false
      await uploadSingleFile(files[0].file, options?.parentId ?? null)
      return
    }

    // Multiple items: batch progress toast
    const stats = getDropResultStats(dropResult)
    const toastId = toast.loading(
      hasFolders ? (
        <FolderProgressContent
          progress={{
            toastId: '',
            totalFiles: stats.totalFiles,
            totalFolders: stats.totalFolders,
            processedFiles: 0,
            processedFolders: 0,
            skippedFiles: 0,
          }}
        />
      ) : (
        <FileProgressContent totalFiles={stats.totalFiles} processedFiles={0} skippedFiles={0} />
      ),
      { duration: Infinity, style: TOAST_STYLE },
    )

    const progress: UploadProgress = {
      toastId,
      totalFiles: stats.totalFiles,
      totalFolders: stats.totalFolders,
      processedFiles: 0,
      processedFolders: 0,
      skippedFiles: 0,
    }

    try {
      // Process root-level files
      for (const { file } of files) {
        try {
          const validation = validateFileForUpload(file)
          const result = await uploadSingleFile(file, options?.parentId ?? null, {
            silent: true,
            navigate: false,
          })
          if (!result && validation.valid) {
            logger.warn(`${file.name}: unsupported file type`)
          }
          if (result) {
            progress.processedFiles++
          } else {
            progress.skippedFiles++
          }
        } catch (error) {
          logger.error(error)
          progress.skippedFiles++
        }
        toast.loading(
          hasFolders ? (
            <FolderProgressContent progress={{ ...progress }} />
          ) : (
            <FileProgressContent
              totalFiles={stats.totalFiles}
              processedFiles={progress.processedFiles}
              skippedFiles={progress.skippedFiles}
            />
          ),
          { id: toastId, duration: Infinity, style: TOAST_STYLE },
        )
      }

      // Process folders
      let lastFolderId: Id<'sidebarItems'> | undefined
      for (const folder of rootFolders) {
        lastFolderId = await uploadFolderRecursive(folder, options?.parentId ?? null, progress)
      }

      // Show success
      toast.dismiss(toastId)
      const skippedText = progress.skippedFiles > 0 ? ` (${progress.skippedFiles} skipped)` : ''
      const message = hasFolders
        ? `Created ${progress.processedFolders} folder${progress.processedFolders !== 1 ? 's' : ''} and ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
        : `Uploaded ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
      toast.success(<ToastContent title="Upload complete" message={message} />, {
        duration: 3000,
        style: TOAST_STYLE,
      })

      // Open parent folders in sidebar
      if (lastFolderId) {
        openParentFolders(lastFolderId)
      } else if (options?.parentId) {
        openParentFolders(options.parentId)
      }
    } catch (error) {
      logger.error(error)
      toast.dismiss(toastId)
      toast.error(<ToastContent title="Upload failed" message={getErrorMessage(error)} />, {
        duration: 5000,
        style: TOAST_STYLE,
      })
    }
  }

  return { handleDrop, uploadSingleFile }
}

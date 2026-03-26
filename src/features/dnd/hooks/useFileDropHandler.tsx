import { useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import {
  isMediaFile,
  isTextFile,
  validateFileForUpload,
} from 'convex/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type {
  DropResult,
  FolderStructure,
} from '~/features/file-upload/utils/folder-reader'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCreateSidebarItem } from '~/features/sidebar/hooks/useCreateSidebarItem'
import { convertTextToBlocks } from '~/features/editor/utils/text-to-blocks'
import {
  FileProgressContent,
  FolderProgressContent,
  ToastContent,
} from '~/features/file-upload/components/file-progress-toasts'
import { getDropResultStats } from '~/features/file-upload/utils/folder-reader'
import {
  getErrorMessage,
  uploadFile,
} from '~/features/file-upload/utils/file-upload'

interface DropOptions {
  parentId: Id<'folders'> | null
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

  const generateUploadUrl = useAppMutation(
    api.storage.mutations.generateUploadUrl,
    { errorMessage: 'Failed to generate upload URL' },
  )
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload, {
    errorMessage: 'Failed to track upload',
  })
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload, {
    errorMessage: 'Failed to commit upload',
  })

  const activeUploadsRef = useRef<Map<string, { toastId: string | number }>>(
    new Map(),
  )

  const uploadSingleFile = async (
    file: File,
    parentId: Id<'folders'> | null,
    silent = false,
  ): Promise<boolean> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return false
    }

    const fileName = file.name
    const uploadId = crypto.randomUUID()
    const validation = validateFileForUpload(file)
    if (!validation.success) {
      if (!silent) toast.error(`${fileName}: ${validation.error}`)
      return false
    }

    let toastId: string | number | undefined
    if (!silent) {
      toastId = toast.loading(
        <ToastContent
          title={fileName}
          message={
            isTextFile(file.type, file.name)
              ? 'Processing...'
              : 'Uploading... 0%'
          }
          progress={isTextFile(file.type, file.name) ? undefined : 0}
        />,
        { duration: Infinity, style: TOAST_STYLE },
      )
      activeUploadsRef.current.set(uploadId, { toastId })
    }

    try {
      if (isTextFile(file.type, file.name)) {
        const blocks = await convertTextToBlocks(file)
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.notes,
          campaignId,
          name: fileName,
          parentId,
          content: blocks,
        })

        if (!silent) {
          toast.dismiss(toastId)
          toast.success(
            <ToastContent title={fileName} message="Note created" />,
            { duration: 3000, style: TOAST_STYLE },
          )
          openParentFolders(result.id)
          navigateToItem(result.slug, true)
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
          originalFileName: fileName,
        })
        await commitUpload.mutateAsync({ storageId })
        const result = await createItem({
          type: SIDEBAR_ITEM_TYPES.files,
          campaignId,
          name: fileName,
          storageId,
          parentId,
        })

        if (!silent) {
          toast.dismiss(toastId)
          toast.success(
            <ToastContent title={fileName} message="File created" />,
            { duration: 3000, style: TOAST_STYLE },
          )
          openParentFolders(result.id)
          navigateToItem(result.slug)
        }
      } else {
        if (silent) {
          console.warn(`${fileName}: unsupported file type`)
        }
        return false
      }

      if (!silent) activeUploadsRef.current.delete(uploadId)
      return true
    } catch (error) {
      if (!silent) activeUploadsRef.current.delete(uploadId)
      if (!silent && toastId) {
        toast.dismiss(toastId)
        toast.error(
          <ToastContent title={fileName} message={getErrorMessage(error)} />,
          { duration: 5000, style: TOAST_STYLE },
        )
      }
      throw error
    }
  }

  const uploadFolderRecursive = async (
    folder: FolderStructure,
    parentId: Id<'folders'> | null,
    progress: UploadProgress,
  ): Promise<Id<'folders'>> => {
    if (!campaignId) {
      throw new Error('Campaign data missing')
    }
    const result = await createItem({
      type: SIDEBAR_ITEM_TYPES.folders,
      campaignId,
      name: folder.name,
      parentId,
    })
    const folderId = result.id as Id<'folders'>

    progress.processedFolders++
    toast.loading(<FolderProgressContent progress={{ ...progress }} />, {
      id: progress.toastId,
      duration: Infinity,
      style: TOAST_STYLE,
    })

    for (const { file, relativePath } of folder.files) {
      try {
        const validation = validateFileForUpload(file)
        const success = await uploadSingleFile(file, folderId, true)
        if (!success && validation.success) {
          console.warn(`${file.name}: unsupported file type`)
        }
        if (success) {
          progress.processedFiles++
        } else {
          progress.skippedFiles++
        }
      } catch (error) {
        console.error(`Failed to process ${relativePath}:`, error)
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

  const handleDrop = async (
    dropResult: DropResult,
    options?: DropOptions,
  ): Promise<void> => {
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
      await uploadSingleFile(files[0].file, options?.parentId ?? null, false)
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
        <FileProgressContent
          totalFiles={stats.totalFiles}
          processedFiles={0}
          skippedFiles={0}
        />
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
      for (const { file, relativePath } of files) {
        try {
          const validation = validateFileForUpload(file)
          const success = await uploadSingleFile(
            file,
            options?.parentId ?? null,
            true,
          )
          if (!success && validation.success) {
            console.warn(`${file.name}: unsupported file type`)
          }
          if (success) {
            progress.processedFiles++
          } else {
            progress.skippedFiles++
          }
        } catch (error) {
          console.error(`Failed to process ${relativePath}:`, error)
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
      let lastFolderId: Id<'folders'> | undefined
      for (const folder of rootFolders) {
        lastFolderId = await uploadFolderRecursive(
          folder,
          options?.parentId ?? null,
          progress,
        )
      }

      // Show success
      toast.dismiss(toastId)
      const skippedText =
        progress.skippedFiles > 0 ? ` (${progress.skippedFiles} skipped)` : ''
      const message = hasFolders
        ? `Created ${progress.processedFolders} folder${progress.processedFolders !== 1 ? 's' : ''} and ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
        : `Uploaded ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
      toast.success(
        <ToastContent title="Upload complete" message={message} />,
        { duration: 3000, style: TOAST_STYLE },
      )

      // Open parent folders in sidebar
      if (lastFolderId) {
        await openParentFolders(lastFolderId)
      } else if (options?.parentId) {
        await openParentFolders(options.parentId)
      }
    } catch (error) {
      console.error('Failed to process drop:', error)
      toast.dismiss(toastId)
      toast.error(
        <ToastContent title="Upload failed" message={getErrorMessage(error)} />,
        { duration: 5000, style: TOAST_STYLE },
      )
    }
  }

  return { handleDrop }
}

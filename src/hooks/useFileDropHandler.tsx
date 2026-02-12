import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import {
  isMediaFile,
  isTextFile,
  validateFileForUpload,
} from 'convex/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { useSidebarItemMutations } from './useSidebarItemMutations'
import { useOpenParentFolders } from './useOpenParentFolders'
import { useEditorNavigation } from './useEditorNavigation'
import { useCampaign } from './useCampaign'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult, FolderStructure } from '~/lib/folder-reader'
import { convertTextToBlocks } from '~/lib/text-to-blocks'
import {
  FileProgressContent,
  FolderProgressContent,
  ToastContent,
} from '~/components/toasts/file-progress-toasts'
import { getDropResultStats } from '~/lib/folder-reader'
import { getErrorMessage, uploadFile } from '~/lib/file-upload'

interface DropOptions {
  campaignId: Id<'campaigns'>
  parentId?: Id<'folders'>
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
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createItem } = useSidebarItemMutations()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.generateUploadUrl),
  })
  const trackUpload = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.trackUpload),
  })
  const commitUpload = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.commitUpload),
  })

  const activeUploadsRef = useRef<Map<string, { toastId: string | number }>>(
    new Map(),
  )

  const uploadSingleFile = useCallback(
    async (
      file: File,
      targetCampaignId: Id<'campaigns'>,
      parentId?: Id<'folders'>,
      silent = false,
    ): Promise<boolean> => {
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
          const result = createItem({
            type: SIDEBAR_ITEM_TYPES.notes,
            campaignId: targetCampaignId,
            name: fileName,
            parentId,
            content: blocks,
          })

          if (!silent && result) {
            toast.dismiss(toastId)
            toast.success(
              <ToastContent title={fileName} message="Note created" />,
              { duration: 3000, style: TOAST_STYLE },
            )
            openParentFolders(result.tempId)
            navigateToItem(result.optimisticItem, true)
          } else if (!result) {
            return false
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
          const result = createItem({
            type: SIDEBAR_ITEM_TYPES.files,
            campaignId: targetCampaignId,
            name: fileName,
            storageId,
            parentId,
          })

          if (!silent && result) {
            toast.dismiss(toastId)
            toast.success(
              <ToastContent title={fileName} message="File created" />,
              { duration: 3000, style: TOAST_STYLE },
            )
            await openParentFolders(result.tempId)
            navigateToItem(result.optimisticItem)
          }
        } else {
          if (silent) {
            console.warn(`${fileName}: unsupported file type`)
          }
          return false
        }

        return true
      } catch (error) {
        if (!silent && toastId) {
          toast.dismiss(toastId)
          toast.error(
            <ToastContent title={fileName} message={getErrorMessage(error)} />,
            { duration: 5000, style: TOAST_STYLE },
          )
        }
        throw error
      } finally {
        if (!silent) activeUploadsRef.current.delete(uploadId)
      }
    },
    [
      createItem,
      generateUploadUrl,
      trackUpload,
      commitUpload,
      openParentFolders,
      navigateToItem,
    ],
  )

  const uploadFolderRecursive = useCallback(
    async (
      folder: FolderStructure,
      targetCampaignId: Id<'campaigns'>,
      parentId: Id<'folders'> | undefined,
      progress: UploadProgress,
    ): Promise<Id<'folders'>> => {
      const result = createItem({
        type: SIDEBAR_ITEM_TYPES.folders,
        campaignId: targetCampaignId,
        name: folder.name,
        parentId,
      })
      if (!result) {
        throw new Error(`Failed to create folder: ${folder.name}`)
      }
      const folderId = result?.tempId as Id<'folders'>

      progress.processedFolders++
      toast.loading(<FolderProgressContent progress={progress} />, {
        id: progress.toastId,
        duration: Infinity,
        style: TOAST_STYLE,
      })

      for (const { file, relativePath } of folder.files) {
        try {
          const validation = validateFileForUpload(file)
          const success = await uploadSingleFile(
            file,
            targetCampaignId,
            folderId,
            true,
          )
          if (!success && validation.success) {
            console.warn(`${file.name}: unsupported file type`)
          }
          progress[success ? 'processedFiles' : 'skippedFiles']++
        } catch (error) {
          console.error(`Failed to process ${relativePath}:`, error)
          progress.skippedFiles++
        }
        toast.loading(<FolderProgressContent progress={progress} />, {
          id: progress.toastId,
          duration: Infinity,
          style: TOAST_STYLE,
        })
      }

      for (const subfolder of folder.subfolders) {
        await uploadFolderRecursive(
          subfolder,
          targetCampaignId,
          folderId,
          progress,
        )
      }

      return folderId
    },
    [createItem, uploadSingleFile],
  )

  const handleDrop = useCallback(
    async (dropResult: DropResult, options?: DropOptions): Promise<void> => {
      const targetCampaignId = options?.campaignId || campaignId
      if (!targetCampaignId) {
        toast.error('No campaign selected')
        return
      }

      const { files, rootFolders } = dropResult
      const hasFolders = rootFolders.length > 0
      const isSingleFile = files.length === 1 && !hasFolders

      // Single file: individual toast with navigation
      if (isSingleFile) {
        // uploadSingleFile handles all toasts when silent=false
        await uploadSingleFile(
          files[0].file,
          targetCampaignId,
          options?.parentId,
          false,
        )
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
              targetCampaignId,
              options?.parentId,
              true,
            )
            if (!success && validation.success) {
              console.warn(`${file.name}: unsupported file type`)
            }
            progress[success ? 'processedFiles' : 'skippedFiles']++
          } catch (error) {
            console.error(`Failed to process ${relativePath}:`, error)
            progress.skippedFiles++
          }
          toast.loading(
            hasFolders ? (
              <FolderProgressContent progress={progress} />
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
            targetCampaignId,
            options?.parentId,
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
          <ToastContent
            title="Upload failed"
            message={getErrorMessage(error)}
          />,
          { duration: 5000, style: TOAST_STYLE },
        )
      }
    },
    [campaignId, uploadSingleFile, uploadFolderRecursive, openParentFolders],
  )

  return { handleDrop }
}

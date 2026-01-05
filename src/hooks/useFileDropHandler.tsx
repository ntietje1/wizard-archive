import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useFileActions } from './useFileActions'
import { useOpenParentFolders } from './useOpenParentFolders'
import { useEditorNavigation } from './useEditorNavigation'
import { useCampaign } from './useCampaign'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { validateFileForUpload } from '~/lib/file-validation'
import { Progress } from '~/components/shadcn/ui/progress'

interface FileDropHandlerOptions {
  campaignId: Id<'campaigns'>
  parentId?: SidebarItemId
}

/**
 * Hook to handle file drops from drag-and-drop operations.
 * Creates files with progress tracking via toast notifications.
 */
export function useFileDropHandler() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createFile } = useFileActions()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToFile } = useEditorNavigation()

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.generateUploadUrl),
  })

  const trackUploadMutation = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.trackUpload),
  })

  const commitUpload = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.commitUpload),
  })

  // Track active uploads for progress updates
  const activeUploadsRef = useRef<
    Map<
      string,
      {
        toastId: string | number
        progress: number
      }
    >
  >(new Map())

  /**
   * Upload a single file with progress tracking via toast
   */
  const uploadFileWithProgress = useCallback(
    async (file: File, fileName: string): Promise<Id<'_storage'>> => {
      const uploadUrl = await generateUploadUrl.mutateAsync({})

      // Create initial toast with progress bar
      const toastId = toast.loading(
        <div className="space-y-2 w-full min-w-[300px]">
          <div className="font-medium text-sm">{fileName}</div>
          <Progress value={0} className="h-1.5 w-full" />
          <div className="text-xs text-muted-foreground">Uploading...</div>
        </div>,
        {
          duration: Infinity, // Keep toast open until we update it
          style: { width: '100%', maxWidth: '100%' },
        },
      )

      activeUploadsRef.current.set(fileName, {
        toastId,
        progress: 0,
      })

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener(
          'progress',
          (event: ProgressEvent<XMLHttpRequestUpload>) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round(
                (event.loaded / event.total) * 100,
              )

              const uploadInfo = activeUploadsRef.current.get(fileName)
              if (uploadInfo) {
                uploadInfo.progress = percentComplete

                // Update toast with new progress
                toast.loading(
                  <div className="space-y-2 w-full min-w-[300px]">
                    <div className="font-medium text-sm">{fileName}</div>
                    <Progress
                      value={percentComplete}
                      className="h-1.5 w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      Uploading... {percentComplete}%
                    </div>
                  </div>,
                  {
                    id: toastId,
                    duration: Infinity,
                    style: { width: '100%', maxWidth: '100%' },
                  },
                )
              }
            }
          },
        )

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                storageId: string
              }
              const storageId = response.storageId as unknown as Id<'_storage'>

              try {
                await trackUploadMutation.mutateAsync({ storageId })
                resolve(storageId)
              } catch (error) {
                console.error('Failed to track upload', error)
                activeUploadsRef.current.delete(fileName)
                toast.dismiss(toastId)
                toast.error(`Failed to track upload: ${fileName}`, {
                  duration: 5000, // Auto-dismiss after 5 seconds for errors
                  style: { width: '100%', maxWidth: '100%' },
                })
                reject(new Error('Failed to track upload'))
              }
            } catch (error) {
              console.error('Failed to parse upload response', error)
              activeUploadsRef.current.delete(fileName)
              toast.dismiss(toastId)
              toast.error(`Failed to parse upload response: ${fileName}`, {
                duration: 5000, // Auto-dismiss after 5 seconds for errors
                style: { width: '100%', maxWidth: '100%' },
              })
              reject(new Error('Failed to parse upload response'))
            }
          } else {
            activeUploadsRef.current.delete(fileName)
            toast.dismiss(toastId)
            toast.error(`Upload failed: ${fileName}`, {
              duration: 5000, // Auto-dismiss after 5 seconds for errors
              style: { width: '100%', maxWidth: '100%' },
            })
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          activeUploadsRef.current.delete(fileName)
          toast.dismiss(toastId)
          toast.error(`Upload failed: ${fileName}`, {
            duration: 5000, // Auto-dismiss after 5 seconds for errors
            style: { width: '100%', maxWidth: '100%' },
          })
          reject(new Error('Upload failed'))
        })

        xhr.addEventListener('abort', () => {
          activeUploadsRef.current.delete(fileName)
          toast.dismiss(toastId)
          toast.error(`Upload cancelled: ${fileName}`, {
            duration: 5000, // Auto-dismiss after 5 seconds for errors
            style: { width: '100%', maxWidth: '100%' },
          })
          reject(new Error('Upload cancelled'))
        })

        xhr.open('POST', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    },
    [generateUploadUrl, trackUploadMutation],
  )

  /**
   * Handle dropping files - validates, uploads, and creates file records
   */
  const handleFileDrop = useCallback(
    async (
      files: Array<File>,
      options?: FileDropHandlerOptions,
    ): Promise<void> => {
      const targetCampaignId = options?.campaignId || campaignId
      if (!targetCampaignId) {
        toast.error('No campaign selected')
        return
      }

      const parentId = options?.parentId

      // Process files sequentially
      for (const file of files) {
        const fileName = file.name

        try {
          // Validate file
          const validation = validateFileForUpload(file)
          if (!validation.success) {
            toast.error(`${fileName}: ${validation.error}`)
            continue
          }

          // Upload file with progress tracking
          const storageId = await uploadFileWithProgress(file, fileName)

          // Commit the upload
          await commitUpload.mutateAsync({ storageId })

          // Create file record
          const { fileId: newFileId, slug: newFileSlug } =
            await createFile.mutateAsync({
              campaignId: targetCampaignId,
              name: fileName,
              storageId,
              parentId,
            })

          // Open parent folders and navigate to file
          await openParentFolders(newFileId)
          navigateToFile(newFileSlug)

          // Update toast to success
          const uploadInfo = activeUploadsRef.current.get(fileName)
          if (uploadInfo) {
            // Dismiss the loading toast first, then show success
            toast.dismiss(uploadInfo.toastId)
            toast.success(
              <div className="space-y-1 w-full min-w-[300px]">
                <div className="font-medium text-sm">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  File created successfully
                </div>
              </div>,
              {
                duration: 3000, // Auto-dismiss after 3 seconds
                style: { width: '100%', maxWidth: '100%' },
              },
            )
            activeUploadsRef.current.delete(fileName)
          }
        } catch (error) {
          console.error(`Failed to process file ${fileName}:`, error)
          const uploadInfo = activeUploadsRef.current.get(fileName)
          if (uploadInfo) {
            toast.dismiss(uploadInfo.toastId)
            toast.error(
              <div className="space-y-1 w-full min-w-[300px]">
                <div className="font-medium text-sm">{fileName}</div>
                <div className="text-xs text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : 'Failed to create file'}
                </div>
              </div>,
              {
                duration: 5000, // Auto-dismiss after 5 seconds for errors
                style: { width: '100%', maxWidth: '100%' },
              },
            )
            activeUploadsRef.current.delete(fileName)
          } else {
            toast.error(
              `${fileName}: ${error instanceof Error ? error.message : 'Failed to create file'}`,
              {
                duration: 5000, // Auto-dismiss after 5 seconds for errors
                style: { width: '100%', maxWidth: '100%' },
              },
            )
          }
        }
      }
    },
    [
      campaignId,
      uploadFileWithProgress,
      commitUpload,
      createFile,
      openParentFolders,
      navigateToFile,
    ],
  )

  return {
    handleFileDrop,
  }
}

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useFileActions } from './useFileActions'
import { useNoteActions } from './useNoteActions'
import { useOpenParentFolders } from './useOpenParentFolders'
import { useEditorNavigation } from './useEditorNavigation'
import { useCampaign } from './useCampaign'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import {
  isMediaFile,
  isTextFile,
  validateFileForUpload,
} from '~/lib/file-validation'
import { convertTextToBlocks } from '~/lib/text-to-blocks'
import { Progress } from '~/components/shadcn/ui/progress'

interface FileDropHandlerOptions {
  campaignId: Id<'campaigns'>
  parentId?: SidebarItemId
}

interface UploadInfo {
  toastId: string | number
  progress: number
}

// Constants
const TOAST_STYLE = { width: '100%', maxWidth: '100%' } as const
const TOAST_SUCCESS_DURATION = 3000
const TOAST_ERROR_DURATION = 5000

// Toast helper functions
const createToastContent = (
  fileName: string,
  message: string,
  progress?: number,
) => (
  <div className="space-y-2 w-full min-w-[300px]">
    <div className="font-medium text-sm">{fileName}</div>
    {progress !== undefined && (
      <Progress value={progress} className="h-1.5 w-full" />
    )}
    <div className="text-xs text-muted-foreground">{message}</div>
  </div>
)

const showUploadProgressToast = (
  fileName: string,
  progress: number,
  toastId?: string | number,
) => {
  const content = createToastContent(
    fileName,
    `Uploading... ${progress}%`,
    progress,
  )
  return toast.loading(content, {
    id: toastId,
    duration: Infinity,
    style: TOAST_STYLE,
  })
}

const showLoadingToast = (fileName: string, message: string) => {
  const content = createToastContent(fileName, message)
  return toast.loading(content, {
    duration: Infinity,
    style: TOAST_STYLE,
  })
}

const showSuccessToast = (fileName: string, message: string) => {
  const content = createToastContent(fileName, message)
  toast.success(content, {
    duration: TOAST_SUCCESS_DURATION,
    style: TOAST_STYLE,
  })
}

const showErrorToast = (
  fileName: string,
  message: string,
  toastId?: string | number,
) => {
  const content = createToastContent(fileName, message)
  if (toastId) {
    toast.dismiss(toastId)
  }
  toast.error(content, {
    duration: TOAST_ERROR_DURATION,
    style: TOAST_STYLE,
  })
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}

export function useFileDropHandler() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { createFile } = useFileActions()
  const { createNote, updateNoteContent } = useNoteActions()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToFile, navigateToNote } = useEditorNavigation()

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.generateUploadUrl),
  })

  const trackUploadMutation = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.trackUpload),
  })

  const commitUpload = useMutation({
    mutationFn: useConvexMutation(api.storage.mutations.commitUpload),
  })

  const activeUploadsRef = useRef<Map<string, UploadInfo>>(new Map())

  const cleanupUpload = useCallback((fileName: string) => {
    const uploadInfo = activeUploadsRef.current.get(fileName)
    if (uploadInfo) {
      toast.dismiss(uploadInfo.toastId)
      activeUploadsRef.current.delete(fileName)
    }
  }, [])

  const uploadFileWithProgress = useCallback(
    async (file: File): Promise<Id<'_storage'>> => {
      const fileName = file.name
      const uploadUrl = await generateUploadUrl.mutateAsync({})

      const toastId = showUploadProgressToast(fileName, 0)

      activeUploadsRef.current.set(fileName, {
        toastId,
        progress: 0,
      })

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        const handleError = (message: string, error?: unknown) => {
          cleanupUpload(fileName)
          showErrorToast(fileName, message, toastId)
          if (error) {
            console.error(message, error)
          }
          reject(new Error(message))
        }

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
                showUploadProgressToast(fileName, percentComplete, toastId)
              }
            }
          },
        )

        xhr.addEventListener('load', async () => {
          if (xhr.status !== 200) {
            handleError(`Upload failed with status ${xhr.status}`)
            return
          }

          try {
            const response = JSON.parse(xhr.responseText) as {
              storageId: string
            }
            const storageId = response.storageId as unknown as Id<'_storage'>

            try {
              await trackUploadMutation.mutateAsync({
                storageId,
                originalFileName: file.name,
              })
              resolve(storageId)
            } catch (error) {
              handleError('Failed to track upload', error)
            }
          } catch (error) {
            handleError('Failed to parse upload response', error)
          }
        })

        xhr.addEventListener('error', () => {
          handleError('Upload failed')
        })

        xhr.addEventListener('abort', () => {
          handleError('Upload cancelled')
        })

        xhr.open('POST', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    },
    [generateUploadUrl, trackUploadMutation, cleanupUpload],
  )

  const handleTextFileUpload = useCallback(
    async (file: File, parentId?: SidebarItemId): Promise<void> => {
      if (!campaignId) return

      const fileName = file.name
      const validation = validateFileForUpload(file)
      if (!validation.success) {
        toast.error(`${fileName}: ${validation.error}`)
        return
      }

      const toastId = showLoadingToast(fileName, 'Processing text file...')

      try {
        const blocks = await convertTextToBlocks(file)
        const { noteId, slug } = await createNote.mutateAsync({
          campaignId,
          name: fileName,
          parentId,
        })

        await updateNoteContent.mutateAsync({
          noteId,
          content: blocks,
        })

        await openParentFolders(noteId)
        navigateToNote(slug, true)

        toast.dismiss(toastId)
        showSuccessToast(fileName, 'Note created successfully')
      } catch (error) {
        console.error(`Failed to process text file ${fileName}:`, error)
        showErrorToast(
          fileName,
          getErrorMessage(error) || 'Failed to create note',
          toastId,
        )
      }
    },
    [
      campaignId,
      createNote,
      updateNoteContent,
      openParentFolders,
      navigateToNote,
    ],
  )

  const handleMediaFileUpload = useCallback(
    async (file: File, parentId?: SidebarItemId): Promise<void> => {
      if (!campaignId) return

      const fileName = file.name
      const validation = validateFileForUpload(file)
      if (!validation.success) {
        toast.error(`${fileName}: ${validation.error}`)
        return
      }

      try {
        const storageId = await uploadFileWithProgress(file)
        await commitUpload.mutateAsync({ storageId })

        const { fileId: newFileId, slug: newFileSlug } =
          await createFile.mutateAsync({
            campaignId,
            name: fileName,
            storageId,
            parentId,
          })

        await openParentFolders(newFileId)
        navigateToFile(newFileSlug)

        cleanupUpload(fileName)
        showSuccessToast(fileName, 'File created successfully')
      } catch (error) {
        console.error(`Failed to process file ${fileName}:`, error)
        cleanupUpload(fileName)
        showErrorToast(fileName, getErrorMessage(error))
      }
    },
    [
      campaignId,
      uploadFileWithProgress,
      commitUpload,
      createFile,
      openParentFolders,
      navigateToFile,
      cleanupUpload,
    ],
  )

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

      for (const file of files) {
        if (isTextFile(file)) {
          await handleTextFileUpload(file, parentId)
        } else if (isMediaFile(file)) {
          await handleMediaFileUpload(file, parentId)
        } else {
          toast.error(`Unsupported file type: ${file.name}`)
        }
      }
    },
    [campaignId, handleMediaFileUpload, handleTextFileUpload],
  )

  return {
    handleFileDrop,
  }
}

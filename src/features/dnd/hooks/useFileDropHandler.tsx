import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { isMediaFile, isTextFile, validateFileForUpload } from 'convex/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import { deduplicateName } from 'convex/sidebarItems/functions/defaultItemName'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult, FolderStructure } from '~/features/file-upload/utils/folder-reader'
import { logger } from '~/shared/utils/logger'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
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
import { useCreateFile } from '~/features/files/hooks/useCreateFile'
import { useCreateNote } from '~/features/notes/hooks/useCreateNote'

interface DropOptions {
  parentId: Id<'sidebarItems'> | null
}

interface UploadSingleFileOptions {
  silent?: boolean
  navigate?: boolean
}

interface UploadSingleFileResult {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
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

function renderBatchProgress(
  hasFolders: boolean,
  stats: ReturnType<typeof getDropResultStats>,
  progress: UploadProgress,
) {
  return hasFolders ? (
    <FolderProgressContent progress={{ ...progress }} />
  ) : (
    <FileProgressContent
      totalFiles={stats.totalFiles}
      processedFiles={progress.processedFiles}
      skippedFiles={progress.skippedFiles}
    />
  )
}

function showBatchProgress(
  toastId: string | number,
  hasFolders: boolean,
  stats: ReturnType<typeof getDropResultStats>,
  progress: UploadProgress,
) {
  toast.loading(renderBatchProgress(hasFolders, stats, progress), {
    id: toastId,
    duration: Infinity,
    style: TOAST_STYLE,
  })
}

function uploadCompleteMessage(hasFolders: boolean, progress: UploadProgress) {
  const skippedText = progress.skippedFiles > 0 ? ` (${progress.skippedFiles} skipped)` : ''
  if (!hasFolders) {
    return `Uploaded ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
  }
  return `Created ${progress.processedFolders} folder${progress.processedFolders !== 1 ? 's' : ''} and ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
}

export function useFileDropHandler() {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateFileSystemItem()
  const { createFile } = useCreateFile()
  const { createNote } = useCreateNote()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()
  const { getSiblings } = useSidebarValidation()

  const generateUploadUrl = useAppMutation(api.storage.mutations.generateUploadUrl)
  const trackUpload = useAppMutation(api.storage.mutations.trackUpload)
  const commitUpload = useAppMutation(api.storage.mutations.commitUpload)
  const { generatePdfPreviewIfNeeded } = usePdfPreviewUpload()

  const createTextFileNote = async (
    file: File,
    fileName: string,
    parentId: Id<'sidebarItems'> | null,
  ) => {
    const blocks = await convertTextToBlocks(file)
    return await createNote({
      name: fileName,
      parentTarget: { kind: 'direct', parentId },
      content: blocks,
    })
  }

  const uploadMediaFile = async (
    file: File,
    fileName: string,
    parentId: Id<'sidebarItems'> | null,
    toastId: string | number | undefined,
  ) => {
    const uploadUrl = await generateUploadUrl.mutateAsync({})
    const storageId = await uploadFile(file, uploadUrl, {
      onProgress: toastId
        ? (pct) => {
            toast.loading(
              <ToastContent title={fileName} message={`Uploading... ${pct}%`} progress={pct} />,
              {
                id: toastId,
                duration: Infinity,
                style: TOAST_STYLE,
              },
            )
          }
        : undefined,
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

    generatePdfPreviewIfNeeded(file, result.id).catch((err: unknown) =>
      logger.error('PDF preview generation failed', err),
    )
    return result
  }

  const uploadSupportedFile = async (
    file: File,
    fileName: string,
    parentId: Id<'sidebarItems'> | null,
    toastId: string | number | undefined,
  ) => {
    if (isTextFile(file.type, file.name)) {
      return {
        result: await createTextFileNote(file, fileName, parentId),
        opensEditor: true,
        successMessage: 'Note created',
      }
    }
    if (isMediaFile(file.type)) {
      return {
        result: await uploadMediaFile(file, fileName, parentId, toastId),
        opensEditor: false,
        successMessage: 'File created',
      }
    }
    return null
  }

  const startSingleFileToast = (
    file: File,
    fileName: string,
    silent: boolean,
  ): string | number | undefined => {
    if (silent) return undefined
    const textFile = isTextFile(file.type, file.name)
    return toast.loading(
      <ToastContent
        title={fileName}
        message={textFile ? 'Processing...' : 'Uploading... 0%'}
        progress={textFile ? undefined : 0}
      />,
      { duration: Infinity, style: TOAST_STYLE },
    )
  }

  const finishSingleFileUpload = ({
    fileName,
    toastId,
    silent,
    navigate,
    upload,
  }: {
    fileName: string
    toastId: string | number | undefined
    silent: boolean
    navigate: boolean
    upload: NonNullable<Awaited<ReturnType<typeof uploadSupportedFile>>>
  }) => {
    if (!silent) {
      toast.dismiss(toastId)
      toast.success(<ToastContent title={fileName} message={upload.successMessage} />, {
        duration: 3000,
        style: TOAST_STYLE,
      })
    }
    if (navigate) {
      openParentFolders(upload.result.id)
      void navigateToItem(upload.result.slug, upload.opensEditor)
    }
  }

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
    const validation = validateFileForUpload(file)
    if (!validation.valid) {
      if (!silent) toast.error(`${fileName}: ${validation.error}`)
      return null
    }

    const toastId = startSingleFileToast(file, fileName, silent)

    try {
      const upload = await uploadSupportedFile(file, fileName, parentId, toastId)
      if (!upload) {
        if (silent) {
          logger.warn(`${fileName}: unsupported file type`)
        }
        return null
      }

      finishSingleFileUpload({ fileName, toastId, silent, navigate, upload })
      return upload.result
    } catch (error) {
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
      await uploadBatchFile(file, folderId, progress)
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

  const uploadRootFiles = async (
    files: DropResult['files'],
    parentId: Id<'sidebarItems'> | null,
    progress: UploadProgress,
    hasFolders: boolean,
    stats: ReturnType<typeof getDropResultStats>,
  ) => {
    for (const { file } of files) {
      await uploadBatchFile(file, parentId, progress)
      showBatchProgress(progress.toastId, hasFolders, stats, progress)
    }
  }

  const uploadBatchFile = async (
    file: File,
    parentId: Id<'sidebarItems'> | null,
    progress: UploadProgress,
  ) => {
    try {
      const validation = validateFileForUpload(file)
      const result = await uploadSingleFile(file, parentId, {
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
  }

  const uploadRootFolders = async (
    rootFolders: DropResult['rootFolders'],
    parentId: Id<'sidebarItems'> | null,
    progress: UploadProgress,
  ) => {
    let lastFolderId: Id<'sidebarItems'> | undefined
    for (const folder of rootFolders) {
      lastFolderId = await uploadFolderRecursive(folder, parentId, progress)
    }
    return lastFolderId
  }

  const handleDrop = async (dropResult: DropResult, options?: DropOptions): Promise<void> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return
    }

    const { files, rootFolders } = dropResult
    const hasFolders = rootFolders.length > 0
    const isSingleFile = files.length === 1 && !hasFolders

    if (isSingleFile) {
      await uploadSingleFile(files[0].file, options?.parentId ?? null)
      return
    }

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
      const parentId = options?.parentId ?? null
      await uploadRootFiles(files, parentId, progress, hasFolders, stats)
      const lastFolderId = await uploadRootFolders(rootFolders, parentId, progress)

      toast.dismiss(toastId)
      const message = uploadCompleteMessage(hasFolders, progress)
      toast.success(<ToastContent title="Upload complete" message={message} />, {
        duration: 3000,
        style: TOAST_STYLE,
      })

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

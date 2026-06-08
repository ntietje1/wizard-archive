import { toast } from 'sonner'
import { isMediaFile, isTextFile, validateFileForUpload } from 'shared/storage/validation'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult, FolderStructure } from '~/features/file-upload/utils/folder-reader'
import { logger } from '~/shared/utils/logger'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { convertTextToBlocks } from '~/features/editor/utils/text-to-blocks'
import {
  FileProgressContent,
  FolderProgressContent,
  ToastContent,
} from '~/features/file-upload/components/file-progress-toasts'
import type { UploadProgress } from '~/features/file-upload/components/file-progress-toasts'
import { getDropResultStats } from '~/features/file-upload/utils/folder-reader'
import { getErrorMessage } from '~/features/file-upload/utils/file-upload'
import { prepareSingleFileUpload } from '~/features/file-upload/utils/single-file-upload-preflight'
import {
  showSingleFileUploadErrorToast,
  showUploadProgressToast,
  UPLOAD_TOAST_STYLE,
} from '~/features/file-upload/utils/upload-toast'
import { useSingleMediaFileUpload } from '~/features/file-upload/hooks/useSingleMediaFileUpload'
import { useCreateNote } from '~/features/notes/hooks/useCreateNote'
import { useAssetsFolder } from '~/features/embeds/hooks/use-assets-folder'
import type { FileDropDestination, FileDropOptions } from '~/features/dnd/types'

interface UploadSingleFileOptions {
  silent?: boolean
  navigate?: boolean
}

interface UploadSingleFileResult {
  id: Id<'sidebarItems'>
  slug: SidebarItemSlug
}

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
    style: UPLOAD_TOAST_STYLE,
  })
}

function uploadCompleteMessage(hasFolders: boolean, progress: UploadProgress) {
  const skippedText = progress.skippedFiles > 0 ? ` (${progress.skippedFiles} skipped)` : ''
  if (!hasFolders) {
    return `Uploaded ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
  }
  return `Created ${progress.processedFolders} folder${progress.processedFolders !== 1 ? 's' : ''} and ${progress.processedFiles} file${progress.processedFiles !== 1 ? 's' : ''}${skippedText}`
}

function startSingleFileToast(
  file: File,
  fileName: string,
  silent: boolean,
): string | number | undefined {
  if (silent) return undefined
  const textFile = isTextFile(file.type, file.name)
  return toast.loading(
    <ToastContent
      title={fileName}
      message={textFile ? 'Processing...' : 'Uploading... 0%'}
      progress={textFile ? undefined : 0}
    />,
    { duration: Infinity, style: UPLOAD_TOAST_STYLE },
  )
}

export function useFileDropHandler() {
  const { campaignId } = useCampaign()
  const { createItem } = useCreateFileSystemItem()
  const { createNote } = useCreateNote()
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()
  const { getSiblings } = useSidebarValidation()
  const { resolveAssetsFolderId } = useAssetsFolder()
  const { uploadSingleMediaFile } = useSingleMediaFileUpload()

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
      const progressOptions = toastId
        ? {
            onProgress: (pct: number) => {
              showUploadProgressToast({ fileName, percentage: pct, toastId })
            },
          }
        : {}
      const result = await uploadSingleMediaFile(file, parentId, {
        silent: true,
        navigate: false,
        ...progressOptions,
      })
      if (!result) return null
      return {
        result,
        opensEditor: false,
        successMessage: 'File created',
      }
    }
    return null
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
        style: UPLOAD_TOAST_STYLE,
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
    const preflight = prepareSingleFileUpload({ campaignId, file, getSiblings, parentId, silent })
    if (!preflight) return null
    const { fileName } = preflight

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
        showSingleFileUploadErrorToast({ error, fileName, toastId })
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
      style: UPLOAD_TOAST_STYLE,
    })

    await folder.files.reduce<Promise<void>>(
      (previousUpload, { file }) =>
        previousUpload.then(() =>
          uploadBatchFile(file, folderId, progress).then(() => {
            toast.loading(<FolderProgressContent progress={{ ...progress }} />, {
              id: progress.toastId,
              duration: Infinity,
              style: UPLOAD_TOAST_STYLE,
            })
          }),
        ),
      Promise.resolve(undefined),
    )

    await folder.subfolders.reduce<Promise<void>>(
      (previousUpload, subfolder) =>
        previousUpload.then(() =>
          uploadFolderRecursive(subfolder, folderId, progress).then(() => undefined),
        ),
      Promise.resolve(undefined),
    )

    return folderId
  }

  const uploadRootFiles = async (
    files: DropResult['files'],
    parentId: Id<'sidebarItems'> | null,
    progress: UploadProgress,
    hasFolders: boolean,
    stats: ReturnType<typeof getDropResultStats>,
  ) => {
    await files.reduce<Promise<void>>(
      (previousUpload, { file }) =>
        previousUpload.then(() =>
          uploadBatchFile(file, parentId, progress).then(() => {
            showBatchProgress(progress.toastId, hasFolders, stats, progress)
          }),
        ),
      Promise.resolve(undefined),
    )
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
    return await rootFolders.reduce<Promise<Id<'sidebarItems'> | undefined>>(
      (previousUpload, folder) =>
        previousUpload.then(() => uploadFolderRecursive(folder, parentId, progress)),
      Promise.resolve<Id<'sidebarItems'> | undefined>(undefined),
    )
  }

  const resolveDropDestinationParentId = async (
    destination: FileDropDestination = { kind: 'direct', parentId: null },
  ) => {
    if (destination.kind === 'assets') {
      return await resolveAssetsFolderId()
    }
    return destination.parentId
  }

  const handleDrop = async (dropResult: DropResult, options?: FileDropOptions): Promise<void> => {
    if (!campaignId) {
      toast.error('No campaign selected')
      return
    }

    const { files, rootFolders } = dropResult
    const hasFolders = rootFolders.length > 0
    const isSingleFile = files.length === 1 && !hasFolders

    if (isSingleFile) {
      const parentId = await resolveDropDestinationParentId(options?.destination)
      await uploadSingleFile(files[0].file, parentId)
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
      { duration: Infinity, style: UPLOAD_TOAST_STYLE },
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
      const parentId = await resolveDropDestinationParentId(options?.destination)
      await uploadRootFiles(files, parentId, progress, hasFolders, stats)
      const lastFolderId = await uploadRootFolders(rootFolders, parentId, progress)

      toast.dismiss(toastId)
      const message = uploadCompleteMessage(hasFolders, progress)
      toast.success(<ToastContent title="Upload complete" message={message} />, {
        duration: 3000,
        style: UPLOAD_TOAST_STYLE,
      })

      if (lastFolderId) {
        openParentFolders(lastFolderId)
      } else if (parentId) {
        openParentFolders(parentId)
      }
    } catch (error) {
      logger.error(error)
      toast.dismiss(toastId)
      toast.error(<ToastContent title="Upload failed" message={getErrorMessage(error)} />, {
        duration: 5000,
        style: UPLOAD_TOAST_STYLE,
      })
    }
  }

  return { handleDrop, uploadSingleFile }
}

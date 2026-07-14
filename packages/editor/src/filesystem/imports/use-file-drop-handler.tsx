import type { ResourceId } from '../../resources/domain-id'
import { toast } from 'sonner'
import type { ResourceSlug } from '../../workspace/resource-contract'

import type { MaybePromise } from '../../../../../shared/common/async'
import type {
  DropResult,
  FileDropDestination,
  FileDropHandleResult,
  FileDropOptions,
} from '../../drag-drop/file-drop'
import { getDropResultStats } from '../../drag-drop/file-drop'
import type { FileSystemLoadState } from '../load-state'
import type { ResourceCatalog } from '../catalog'
import { FileProgressContent } from './file-progress-content'
import { FolderProgressContent } from './folder-progress-content'
import type { UploadProgress } from './progress-toasts'
import { ToastContent } from './toast-content'
import {
  getErrorMessage,
  showSingleFileUploadErrorToast,
  showUploadProgressToast,
  UPLOAD_TOAST_STYLE,
} from './upload-toast'
import { createAssetsFolderResolver } from '../assets-folder'
import { createBrowserImportFile } from '../browser-import-file'
import type { FileSystemItemDropImportOperations } from '../item-operation-contracts'

interface UploadSingleFileOptions {
  silent?: boolean
  navigate?: boolean
}

interface UploadSingleFileResult {
  id: ResourceId
  slug: ResourceSlug
}

type FileDropFileSystem = {
  catalog: Pick<ResourceCatalog, 'getVisibleRoots' | 'getKnownItemById'>
  load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus'>
  operations: FileSystemItemDropImportOperations
}

type ImportFileResult = Awaited<ReturnType<FileDropFileSystem['operations']['importFile']>>
type ImportDropResult = Awaited<ReturnType<FileDropFileSystem['operations']['importDrop']>>
type ImportFolderEntry = Parameters<
  FileDropFileSystem['operations']['importDrop']
>[0]['rootFolders'][number]
type RevealDroppedItem = (itemId: ResourceId) => void | Promise<void>
type OpenDroppedItem = (
  itemId: ResourceId,
  options?: { heading?: string; replace?: boolean },
) => MaybePromise<void>

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

function skippedUploadMessage({
  skippedFiles,
  skippedFileDetails,
}: Pick<ImportDropResult, 'skippedFiles' | 'skippedFileDetails'>) {
  const skippedItems = skippedFiles
  const skippedText = `${skippedItems} item${skippedItems !== 1 ? 's' : ''} skipped`
  const skippedReasons = skippedFileDetails.map(skippedFileMessage).join('; ')
  return skippedReasons ? `${skippedText}: ${skippedReasons}` : skippedText
}

function skippedFileMessage(skippedFile: ImportDropResult['skippedFileDetails'][number]) {
  if (skippedFile.reason === 'unsupported') {
    return `${skippedFile.fileName}: unsupported file type`
  }
  if (skippedFile.reason === 'invalid') {
    return `${skippedFile.fileName}: ${skippedErrorMessage(skippedFile.error, 'Invalid file')}`
  }
  return `${skippedFile.fileName}: ${skippedErrorMessage(skippedFile.error, 'Upload failed')}`
}

function skippedErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error) return error
  if (error instanceof Error) return error.message
  return fallback
}

function startSingleFileToast(fileName: string, silent: boolean): string | number | undefined {
  if (silent) return undefined
  return toast.loading(<ToastContent title={fileName} message="Processing..." />, {
    duration: Infinity,
    style: UPLOAD_TOAST_STYLE,
  })
}

function startBatchUploadToast(hasFolders: boolean, stats: ReturnType<typeof getDropResultStats>) {
  return toast.loading(
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
}

function logSkippedFiles(receipt: ImportDropResult) {
  for (const skippedFile of receipt.skippedFileDetails) {
    switch (skippedFile.reason) {
      case 'failed':
        console.error(skippedFile.error)
        break
      case 'invalid':
        console.warn(skippedFileMessage(skippedFile))
        break
      case 'unsupported':
        console.warn(`${skippedFile.fileName}: unsupported file type`)
        break
    }
  }
}

function finishBatchUpload(
  toastId: string | number,
  hasFolders: boolean,
  progress: UploadProgress,
  receipt: ImportDropResult,
) {
  progress.processedFiles = receipt.processedFiles
  progress.processedFolders = receipt.processedFolders
  progress.skippedFiles = receipt.skippedFiles
  toast.dismiss(toastId)
  if (receipt.skippedFiles > 0 && receipt.processedFiles + receipt.processedFolders === 0) {
    toast.error(<ToastContent title="Upload skipped" message={skippedUploadMessage(receipt)} />, {
      duration: 5000,
      style: UPLOAD_TOAST_STYLE,
    })
    return
  }

  toast.success(
    <ToastContent title="Upload complete" message={uploadCompleteMessage(hasFolders, progress)} />,
    {
      duration: 3000,
      style: UPLOAD_TOAST_STYLE,
    },
  )
}

function revealBatchUploadDestination(
  receipt: ImportDropResult,
  parentId: ResourceId | null,
  revealItem: RevealDroppedItem,
) {
  const itemId = receipt.lastFolderId ?? parentId
  if (itemId) runDroppedItemNavigation(() => revealItem(itemId))
}

export function useFileDropHandler(
  filesystem: FileDropFileSystem,
  { openItem, revealItem }: { openItem: OpenDroppedItem; revealItem: RevealDroppedItem },
) {
  const {
    operations: { importDrop, importFile },
  } = filesystem
  const { resolveAssetsFolderId } = createAssetsFolderResolver(filesystem)

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
    upload: Extract<ImportFileResult, { status: 'imported' }>
  }) => {
    if (!silent) {
      toast.dismiss(toastId)
      const message = upload.kind === 'note' ? 'Note created' : 'File created'
      toast.success(<ToastContent title={fileName} message={message} />, {
        duration: 3000,
        style: UPLOAD_TOAST_STYLE,
      })
    }
    if (navigate) {
      runDroppedItemNavigation(() => revealItem(upload.result.id))
      runDroppedItemNavigation(() =>
        openItem(upload.result.id, { replace: upload.kind === 'note' }),
      )
    }
  }

  const uploadSingleFile = async (
    file: File,
    parentId: ResourceId | null,
    { silent = false, navigate = true }: UploadSingleFileOptions = {},
  ): Promise<UploadSingleFileResult | null> => {
    const toastId = startSingleFileToast(file.name, silent)

    try {
      const upload = await importFile({
        file: createBrowserImportFile(file),
        parentId,
        onProgress: ({ fileName, percentage }) => {
          if (toastId !== undefined) {
            showUploadProgressToast({ fileName, percentage, toastId })
          }
        },
      })
      if (upload.status === 'skipped') {
        handleSingleFileSkip({ silent, toastId, upload })
        return null
      }

      finishSingleFileUpload({ fileName: upload.fileName, toastId, silent, navigate, upload })
      return upload.result
    } catch (error) {
      if (!silent && toastId !== undefined) {
        showSingleFileUploadErrorToast({ error, fileName: file.name, toastId })
      }
      throw error
    }
  }

  const resolveDropDestinationParentId = async (
    destination: FileDropDestination = { kind: 'direct', parentId: null },
  ) => {
    if (destination.kind === 'assets') {
      return await resolveAssetsFolderId()
    }
    return destination.parentId
  }

  const uploadBatchDrop = async (
    dropResult: DropResult,
    destination: FileDropDestination | undefined,
  ): Promise<FileDropHandleResult> => {
    const { files, rootFolders } = dropResult
    const hasFolders = rootFolders.length > 0
    const stats = getDropResultStats(dropResult)
    const toastId = startBatchUploadToast(hasFolders, stats)
    const progress: UploadProgress = {
      toastId,
      totalFiles: stats.totalFiles,
      totalFolders: stats.totalFolders,
      processedFiles: 0,
      processedFolders: 0,
      skippedFiles: 0,
    }

    try {
      const parentId = await resolveDropDestinationParentId(destination)
      const receipt = await importDrop({
        files: files.map(({ file }) => ({ file: createBrowserImportFile(file) })),
        rootFolders: toWorkspaceImportFolders(rootFolders),
        parentId,
        onFileProgress: ({ fileName, percentage }) => {
          showUploadProgressToast({ fileName, percentage, toastId })
        },
        onProgress: (nextProgress) => {
          progress.processedFiles = nextProgress.processedFiles
          progress.processedFolders = nextProgress.processedFolders
          progress.skippedFiles = nextProgress.skippedFiles
          showBatchProgress(toastId, hasFolders, stats, progress)
        },
      })
      logSkippedFiles(receipt)
      finishBatchUpload(toastId, hasFolders, progress, receipt)
      revealBatchUploadDestination(receipt, parentId, revealItem)
      return { status: 'completed', receipt }
    } catch (error) {
      console.error(error)
      toast.dismiss(toastId)
      toast.error(<ToastContent title="Upload failed" message={getErrorMessage(error)} />, {
        duration: 5000,
        style: UPLOAD_TOAST_STYLE,
      })
      throw error
    }
  }

  const handleDrop = async (
    dropResult: DropResult,
    options?: FileDropOptions,
  ): Promise<FileDropHandleResult> => {
    const isSingleFile = dropResult.files.length === 1 && dropResult.rootFolders.length === 0
    if (!isSingleFile) return await uploadBatchDrop(dropResult, options?.destination)

    try {
      const parentId = await resolveDropDestinationParentId(options?.destination)
      const upload = await uploadSingleFile(dropResult.files[0].file, parentId)
      return { status: 'completed', receipt: upload }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  return { handleDrop, uploadSingleFile }
}

function toWorkspaceImportFolders(folders: DropResult['rootFolders']): Array<ImportFolderEntry> {
  return folders.map((folder) => ({
    name: folder.name,
    files: folder.files.map(({ file }) => ({ file: createBrowserImportFile(file) })),
    subfolders: toWorkspaceImportFolders(folder.subfolders),
  }))
}

function runDroppedItemNavigation(callback: () => MaybePromise<void>) {
  try {
    void Promise.resolve(callback()).catch((error) => console.error(error))
  } catch (error) {
    console.error(error)
  }
}

function handleSingleFileSkip({
  silent,
  toastId,
  upload,
}: {
  silent: boolean
  toastId: string | number | undefined
  upload: Extract<ImportFileResult, { status: 'skipped' }>
}) {
  if (silent) {
    console.warn(getSingleFileSkipWarning(upload))
    return
  }

  if (toastId !== undefined) toast.dismiss(toastId)
  if (upload.reason === 'invalid') {
    toast.error(`${upload.fileName}: ${skippedErrorMessage(upload.error, 'Invalid file')}`)
    return
  }
  if (upload.reason === 'failed') {
    toast.error(`${upload.fileName}: ${skippedErrorMessage(upload.error, 'Upload failed')}`)
    return
  }
  toast.error(`${upload.fileName}: unsupported file type`)
}

function getSingleFileSkipWarning(upload: Extract<ImportFileResult, { status: 'skipped' }>) {
  if (upload.reason === 'unsupported') return `${upload.fileName}: unsupported file type`
  if (upload.reason === 'invalid') {
    return `${upload.fileName}: ${skippedErrorMessage(upload.error, 'Invalid file')}`
  }
  return `${upload.fileName}: ${skippedErrorMessage(upload.error, 'Upload failed')}`
}

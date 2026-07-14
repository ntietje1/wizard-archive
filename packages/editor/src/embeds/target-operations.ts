import type { ResourceId } from '../resources/domain-id'
import { createElement } from 'react'
import { toast } from 'sonner'
import type { FileSystemLoadState } from '../filesystem/load-state'
import type { ResourceCatalog } from '../filesystem/catalog'
import { createAssetsFolderResolver } from '../filesystem/assets-folder'
import { createBrowserImportFile } from '../filesystem/browser-import-file'
import { ToastContent } from '../filesystem/imports/toast-content'
import {
  showSingleFileUploadErrorToast,
  showUploadProgressToast,
  UPLOAD_TOAST_STYLE,
} from '../filesystem/imports/upload-toast'
import type { FileSystemPermissions } from '../filesystem/permissions'
import type { FileSystemItemImportOperations } from '../filesystem/item-operation-contracts'

export type EmbedTargetUploadFileResult =
  | {
      status: 'completed'
      itemId: ResourceId
    }
  | {
      status: 'skipped'
      reason: 'failed' | 'unavailable' | 'unsupported'
      error?: unknown
    }

export type EmbedTargetOperations = {
  uploadFile?: (file: File) => Promise<EmbedTargetUploadFileResult>
}

export interface EmbedTargetOperationFileSystem {
  catalog: Pick<ResourceCatalog, 'getVisibleRoots'>
  load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus'>
  operations: FileSystemItemImportOperations
  permissions: Pick<FileSystemPermissions, 'canEdit'>
}

let embedUploadToastIdSequence = 0

export function createWorkspaceEmbedTargetOperations(
  filesystem: EmbedTargetOperationFileSystem,
): EmbedTargetOperations | undefined {
  if (!filesystem.permissions.canEdit) return undefined

  const { resolveAssetsFolderId } = createAssetsFolderResolver(filesystem)

  return {
    uploadFile: async (file) => {
      const toastId = `embed-upload-${file.name}-${++embedUploadToastIdSequence}`

      try {
        const result = await filesystem.operations.importFile({
          file: createBrowserImportFile(file),
          parentId: await resolveAssetsFolderId(),
          acceptedKinds: ['file'],
          onProgress: ({ fileName, percentage }) => {
            showUploadProgressToast({ fileName, percentage, toastId })
          },
        })

        if (result.status === 'skipped') {
          const fallbackMessage = getSkippedImportFallbackMessage(result.reason)
          showSingleFileUploadErrorToast({
            error: result.error ?? new Error(fallbackMessage),
            fileName: result.fileName,
            toastId,
          })
          return mapSkippedImportToEmbedUploadResult(result)
        }

        toast.dismiss(toastId)
        if (result.kind !== 'file') {
          showSingleFileUploadErrorToast({
            error: new Error('Unsupported file type'),
            fileName: result.fileName,
            toastId,
          })
          return { status: 'skipped', reason: 'unsupported' }
        }

        toast.success(
          createElement(ToastContent, { title: result.fileName, message: 'File created' }),
          {
            duration: 3000,
            style: UPLOAD_TOAST_STYLE,
          },
        )
        return { status: 'completed', itemId: result.result.id }
      } catch (error) {
        showSingleFileUploadErrorToast({ error, fileName: file.name, toastId })
        return { status: 'skipped', reason: 'failed', error }
      }
    },
  }
}

function mapSkippedImportToEmbedUploadResult(
  result: Extract<
    Awaited<ReturnType<FileSystemItemImportOperations['importFile']>>,
    { status: 'skipped' }
  >,
): EmbedTargetUploadFileResult {
  return {
    status: 'skipped',
    reason: skippedImportDetails[result.reason].reason,
    ...(result.error === undefined ? {} : { error: result.error }),
  }
}

type SkippedImportReason = Extract<
  Awaited<ReturnType<FileSystemItemImportOperations['importFile']>>,
  { status: 'skipped' }
>['reason']

const skippedImportDetails = {
  failed: { reason: 'failed', fallbackMessage: 'Upload failed' },
  unavailable: { reason: 'unavailable', fallbackMessage: 'Destination unavailable' },
  invalid: { reason: 'unsupported', fallbackMessage: 'Unsupported file type' },
  unsupported: { reason: 'unsupported', fallbackMessage: 'Unsupported file type' },
} as const satisfies Record<
  SkippedImportReason,
  {
    reason: Extract<EmbedTargetUploadFileResult, { status: 'skipped' }>['reason']
    fallbackMessage: string
  }
>

function getSkippedImportFallbackMessage(reason: SkippedImportReason) {
  return skippedImportDetails[reason].fallbackMessage
}

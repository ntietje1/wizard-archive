import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import { validateFileUpload } from '../../../../shared/storage/validation'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'
import { completedResourceOperation } from '../filesystem/transaction-contract'
import type { FileItem } from './item-contract'
import type { ResourceImportFile } from './import-contract'

type FileIoCommandWriteInput = {
  file: ResourceImportFile
  fileId: SidebarItemId
  onProgress?: (percentage: number) => void
}

type FileIoCommand =
  | {
      type: 'importFile'
      file: ResourceImportFile
      fileId: SidebarItemId
      onProgress?: (percentage: number) => void
    }
  | {
      type: 'replaceFile'
      file: ResourceImportFile
      fileId: SidebarItemId
    }

interface FileIoCommandExecutor {
  canReplaceFile: (file: FileItem) => boolean
  getFileTargetById: (fileId: SidebarItemId) => FileItem | null
  maxUploadBytes?: number
  readOnlyErrorMessage?: string
  writeFile: (input: FileIoCommandWriteInput) => MaybePromise<void>
}

export async function executeFileIoCommand(
  command: FileIoCommand,
  executor: FileIoCommandExecutor,
): Promise<ResourceOperationResult> {
  if (command.type === 'replaceFile') {
    const item = executor.getFileTargetById(command.fileId)
    if (!item) {
      return { status: 'unavailable', reason: 'file_not_found' }
    }

    if (!executor.canReplaceFile(item)) {
      return {
        status: 'error',
        error: new Error(executor.readOnlyErrorMessage ?? 'This workspace is read-only'),
      }
    }
  }

  const validation = validateFileIoInput(command.file, executor.maxUploadBytes)
  if (validation.status === 'invalid') {
    return { status: 'error', error: new Error(validation.error) }
  }

  try {
    await executor.writeFile({
      file: command.file,
      fileId: command.fileId,
      onProgress: command.type === 'importFile' ? command.onProgress : undefined,
    })
  } catch (error) {
    return { status: 'error', error }
  }

  return completedResourceOperation({
    kind: command.type === 'importFile' ? 'fileImported' : 'fileReplaced',
    itemId: command.fileId,
    affectedCount: 1,
  })
}

export function validateFileIoInput(
  file: ResourceImportFile,
  maxUploadBytes: number | undefined,
):
  | {
      status: 'valid'
    }
  | {
      status: 'invalid'
      error: string
    } {
  const validation = validateFileUpload(file.contentType, file.size, file.name, maxUploadBytes)
  return validation.valid ? { status: 'valid' } : { status: 'invalid', error: validation.error }
}

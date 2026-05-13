import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import { logger } from '~/shared/utils/logger'

export async function runFileSystemMutation({
  patches,
  mutate,
  applyPatches,
  onSuccess,
  onError,
}: {
  patches: {
    apply: Array<FileSystemPatch>
    rollback: Array<FileSystemPatch>
  }
  mutate: () => Promise<FileSystemTransactionReceipt>
  applyPatches: (patches: Array<FileSystemPatch>) => void
  onSuccess: (receipt: FileSystemTransactionReceipt) => Promise<void> | void
  onError: (error: unknown) => Promise<void> | void
}): Promise<FileSystemTransactionReceipt | null> {
  try {
    applyPatchArray(applyPatches, patches.apply)
  } catch (error) {
    await reportFileSystemError(onError, error)
    return null
  }

  let receipt: FileSystemTransactionReceipt
  try {
    receipt = await mutate()
  } catch (error) {
    try {
      applyPatchArray(applyPatches, patches.rollback)
    } catch (rollbackError) {
      await reportFileSystemError(onError, rollbackError)
    }
    await reportFileSystemError(onError, error)
    return null
  }

  try {
    applyPatchArray(applyPatches, [...patches.rollback, ...receipt.patches])
  } catch (error) {
    await reportFileSystemError(onError, error)
  }

  try {
    await onSuccess(receipt)
    return receipt
  } catch (error) {
    await reportFileSystemError(onError, error)
    return null
  }
}

async function reportFileSystemError(
  onError: (error: unknown) => Promise<void> | void,
  error: unknown,
) {
  try {
    await onError(error)
  } catch (reportError) {
    logger.error(reportError)
  }
}

function applyPatchArray(
  applyPatches: (patches: Array<FileSystemPatch>) => void,
  patches: Array<FileSystemPatch>,
): void {
  if (patches.length === 0) return
  try {
    applyPatches(patches)
  } catch (error) {
    logger.error(error)
    throw error
  }
}

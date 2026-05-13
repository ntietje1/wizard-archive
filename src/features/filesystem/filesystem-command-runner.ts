import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import { logger } from '~/shared/utils/logger'

let mutationQueue = Promise.resolve()

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
  const run = async () => {
    try {
      applyPatchArray(applyPatches, patches.apply)
      const receipt = await mutate()
      applyPatchArray(applyPatches, [...patches.rollback, ...receipt.patches])
      try {
        await onSuccess(receipt)
      } catch (successError) {
        logger.error(successError)
      }
      return receipt
    } catch (error) {
      applyPatchArray(applyPatches, patches.rollback)
      try {
        await onError(error)
      } catch (errorError) {
        logger.error(errorError)
      }
      return null
    }
  }

  const result = mutationQueue.then(run, run)
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return await result
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

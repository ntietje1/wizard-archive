import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import { logger } from '~/shared/utils/logger'

type OptimisticPatchPlan = {
  forwardPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
}

let mutationQueue = Promise.resolve()

export async function runFileSystemMutation({
  optimistic,
  mutate,
  applyPatches,
  onSuccess,
  onError,
}: {
  optimistic: OptimisticPatchPlan
  mutate: () => Promise<FileSystemTransactionReceipt>
  applyPatches: (patches: Array<FileSystemPatch>) => void
  onSuccess: (receipt: FileSystemTransactionReceipt) => Promise<void> | void
  onError: (error: unknown) => Promise<void> | void
}): Promise<FileSystemTransactionReceipt | null> {
  const run = async () => {
    try {
      applyPatchArray(applyPatches, optimistic.forwardPatches)
      const receipt = await mutate()
      applyPatchArray(applyPatches, [...optimistic.inversePatches, ...receipt.patches])
      try {
        await onSuccess(receipt)
      } catch (successError) {
        logger.error(successError)
      }
      return receipt
    } catch (error) {
      applyPatchArray(applyPatches, optimistic.inversePatches)
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

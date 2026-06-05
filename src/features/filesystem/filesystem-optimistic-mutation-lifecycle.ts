import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemCacheAdapter } from './filesystem-cache-adapter'

type ProgressToastId = string | number
type ProgressReporter = (error: unknown, message: string) => void

function showProgressSafely({
  progressMessage,
  showProgress,
  reportError,
}: {
  progressMessage: string | undefined
  showProgress: (message: string) => ProgressToastId
  reportError: ProgressReporter
}): ProgressToastId | null {
  if (!progressMessage) return null
  try {
    return showProgress(progressMessage)
  } catch (error) {
    reportError(error, 'Failed to show filesystem progress')
    return null
  }
}

function dismissProgressSafely({
  progressToastId,
  dismissProgress,
  reportError,
}: {
  progressToastId: ProgressToastId | null
  dismissProgress: (toastId: ProgressToastId) => void
  reportError: ProgressReporter
}) {
  if (progressToastId === null) return
  try {
    dismissProgress(progressToastId)
  } catch (error) {
    reportError(error, 'Failed to dismiss filesystem progress')
  }
}

export async function runFileSystemOptimisticMutation({
  cacheAdapter,
  apply,
  rollback,
  mutate,
  onOptimisticApplied,
  onMutationFailure,
  onSuccess,
  errorMessage,
  progressMessage,
  reportError,
  showProgress,
  dismissProgress,
}: {
  cacheAdapter: FileSystemCacheAdapter
  apply: Array<FileSystemPatch>
  rollback: Array<FileSystemPatch>
  mutate: () => Promise<FileSystemTransactionReceipt>
  onOptimisticApplied?: () => Promise<void> | void
  onMutationFailure?: () => Promise<void> | void
  onSuccess: (receipt: FileSystemTransactionReceipt) => Promise<void> | void
  errorMessage: string
  progressMessage?: string
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
}): Promise<FileSystemTransactionReceipt | null> {
  try {
    cacheAdapter.applyPatches(apply)
  } catch (error) {
    reportError(error, errorMessage)
    return null
  }

  try {
    await onOptimisticApplied?.()
  } catch (error) {
    try {
      cacheAdapter.applyPatches(rollback)
      await onMutationFailure?.()
    } catch (rollbackError) {
      reportError(rollbackError, errorMessage)
    }
    reportError(error, errorMessage)
    return null
  }

  let receipt: FileSystemTransactionReceipt | null = null
  let mutationError: unknown = null
  const progressToastId = showProgressSafely({ progressMessage, showProgress, reportError })
  try {
    receipt = await mutate()
  } catch (error) {
    mutationError = error
  } finally {
    dismissProgressSafely({ progressToastId, dismissProgress, reportError })
  }

  if (mutationError) {
    try {
      cacheAdapter.applyPatches(rollback)
      await onMutationFailure?.()
    } catch (rollbackError) {
      reportError(rollbackError, errorMessage)
    }
    reportError(mutationError, errorMessage)
    return null
  }
  if (!receipt) return null

  try {
    cacheAdapter.applyPatches([...rollback, ...receipt.patches])
  } catch (error) {
    reportError(error, errorMessage)
    return null
  }
  try {
    await onSuccess(receipt)
  } catch (error) {
    reportError(error, errorMessage)
  }
  return receipt
}

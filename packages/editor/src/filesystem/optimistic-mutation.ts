import type { ResourceTransactionReceipt } from './transaction-contract'
import type { ResourcePatch } from './patch-contract'
import type { FileSystemCacheAdapter } from './cache'

type ProgressToastId = string | number
type ProgressReporter = (error: unknown, message: string) => void

export type FileSystemOptimisticMutationArgs = {
  cacheAdapter: FileSystemCacheAdapter
  apply: Array<ResourcePatch>
  rollback: Array<ResourcePatch>
  mutate: () => Promise<ResourceTransactionReceipt>
  onOptimisticApplied?: () => Promise<void> | void
  onMutationFailure?: () => Promise<void> | void
  onSuccess: (receipt: ResourceTransactionReceipt) => Promise<void> | void
  errorMessage: string
  progressMessage?: string
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
}

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

async function runMutationFailureEffects({
  cacheAdapter,
  rollback,
  onMutationFailure,
  reportError,
  errorMessage,
}: {
  cacheAdapter: FileSystemCacheAdapter
  rollback: Array<ResourcePatch>
  onMutationFailure: (() => Promise<void> | void) | undefined
  reportError: ProgressReporter
  errorMessage: string
}) {
  try {
    cacheAdapter.applyPatches(rollback)
  } catch (error) {
    reportError(error, errorMessage)
  }

  try {
    await onMutationFailure?.()
  } catch (error) {
    reportError(error, errorMessage)
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
}: FileSystemOptimisticMutationArgs): Promise<ResourceTransactionReceipt | null> {
  try {
    cacheAdapter.applyPatches(apply)
  } catch (error) {
    reportError(error, errorMessage)
    return null
  }

  try {
    await onOptimisticApplied?.()
  } catch (error) {
    reportError(error, errorMessage)
  }

  let receipt: ResourceTransactionReceipt | null = null
  let mutationError: unknown = null
  let didMutationFail = false
  const progressToastId = showProgressSafely({ progressMessage, showProgress, reportError })
  try {
    receipt = await mutate()
  } catch (error) {
    mutationError = error
    didMutationFail = true
  } finally {
    dismissProgressSafely({ progressToastId, dismissProgress, reportError })
  }

  if (didMutationFail) {
    await runMutationFailureEffects({
      cacheAdapter,
      rollback,
      onMutationFailure,
      reportError,
      errorMessage,
    })
    reportError(mutationError, errorMessage)
    return null
  }
  if (!receipt) {
    await runMutationFailureEffects({
      cacheAdapter,
      rollback,
      onMutationFailure,
      reportError,
      errorMessage,
    })
    reportError(new Error('Filesystem mutation returned no receipt'), errorMessage)
    return null
  }

  try {
    cacheAdapter.applyPatches([...rollback, ...receipt.patches])
  } catch (error) {
    reportError(error, errorMessage)
    await runMutationFailureEffects({
      cacheAdapter,
      rollback,
      onMutationFailure,
      reportError,
      errorMessage,
    })
    return null
  }
  try {
    await onSuccess(receipt)
  } catch (error) {
    reportError(error, errorMessage)
  }
  return receipt
}

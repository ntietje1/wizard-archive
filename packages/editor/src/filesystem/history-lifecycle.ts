import type { ResourceCommandResult, ResourceTransactionReceipt } from './transaction-contract'
import type { FileSystemCacheAdapter } from './cache'
import { getHistoryProgressToastText } from './progress-messages'
import { executeFileSystemReceiptLifecycle } from './receipt-lifecycle'
import type { FileSystemHistoryEntry } from './undo-store'

type ProgressToastId = string | number
type FileSystemHistoryDirection = 'undo' | 'redo'

type FileSystemHistoryLifecycleArgs = {
  direction: FileSystemHistoryDirection
  entry: FileSystemHistoryEntry
  cacheAdapter: FileSystemCacheAdapter
  runMutation: (
    operation: () => Promise<ResourceTransactionReceipt | null>,
  ) => Promise<ResourceTransactionReceipt | null>
  executeMutation: (
    transactionId: FileSystemHistoryEntry['transactionId'],
  ) => Promise<ResourceTransactionReceipt>
  isEntryStale?: (entry: FileSystemHistoryEntry) => boolean
  recordHistorySuccess: (entry: FileSystemHistoryEntry) => void
  applyReceiptSideEffects: (receipt: ResourceTransactionReceipt) => Promise<void>
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
  showReceiptToast: (receipt: ResourceTransactionReceipt) => void
}

export async function executeFileSystemHistoryLifecycle({
  direction,
  entry,
  cacheAdapter,
  runMutation,
  executeMutation,
  isEntryStale,
  recordHistorySuccess,
  applyReceiptSideEffects,
  reportError,
  showProgress,
  dismissProgress,
  showReceiptToast,
}: FileSystemHistoryLifecycleArgs): Promise<ResourceCommandResult<never>> {
  if (isEntryStale?.(entry)) return { status: 'rejected', reason: 'stale-history' }

  return await executeFileSystemReceiptLifecycle({
    cacheAdapter,
    apply: [],
    rollback: [],
    mutate: () => executeMutation(entry.transactionId),
    onSuccess: async (historyReceipt) => {
      recordHistorySuccess(entry)
      await applyReceiptSideEffects(historyReceipt)
    },
    errorMessage: direction === 'undo' ? 'Filesystem undo failed' : 'Filesystem redo failed',
    progressMessage: getHistoryProgressToastText(direction),
    runMutation,
    reportError,
    showProgress,
    dismissProgress,
    showReceiptToast,
  })
}

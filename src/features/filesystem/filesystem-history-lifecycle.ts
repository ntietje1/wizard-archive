import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemCacheAdapter } from './filesystem-cache-adapter'
import { getHistoryProgressToastText } from './filesystem-progress-messages'
import { runFileSystemOptimisticMutation } from './filesystem-optimistic-mutation-lifecycle'

type ProgressToastId = string | number
type FileSystemHistoryDirection = 'undo' | 'redo'
type FileSystemHistoryEntry = {
  transactionId: Id<'filesystemTransactions'>
}

type FileSystemHistoryLifecycleArgs = {
  direction: FileSystemHistoryDirection
  entry: FileSystemHistoryEntry
  cacheAdapter: FileSystemCacheAdapter
  runMutation: (
    operation: () => Promise<FileSystemTransactionReceipt | null>,
  ) => Promise<FileSystemTransactionReceipt | null>
  executeMutation: (
    transactionId: Id<'filesystemTransactions'>,
  ) => Promise<FileSystemTransactionReceipt>
  recordHistorySuccess: (entry: FileSystemHistoryEntry) => void
  applyReceiptSideEffects: (receipt: FileSystemTransactionReceipt) => Promise<void>
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
  showReceiptToast: (receipt: FileSystemTransactionReceipt) => void
}

export async function executeFileSystemHistoryLifecycle({
  direction,
  entry,
  cacheAdapter,
  runMutation,
  executeMutation,
  recordHistorySuccess,
  applyReceiptSideEffects,
  reportError,
  showProgress,
  dismissProgress,
  showReceiptToast,
}: FileSystemHistoryLifecycleArgs): Promise<FileSystemTransactionReceipt | null> {
  const receipt = await runMutation(() =>
    runFileSystemOptimisticMutation({
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
      reportError,
      showProgress,
      dismissProgress,
    }),
  )
  if (receipt) showReceiptToast(receipt)
  return receipt
}

import type { ResourceCommandResult, ResourceTransactionReceipt } from './transaction-contract'
import { runFileSystemOptimisticMutation } from './optimistic-mutation'
import type { FileSystemOptimisticMutationArgs } from './optimistic-mutation'

type FileSystemReceiptLifecycleArgs = FileSystemOptimisticMutationArgs & {
  runMutation: (
    operation: () => Promise<ResourceTransactionReceipt | null>,
  ) => Promise<ResourceTransactionReceipt | null>
  showReceiptToast: (receipt: ResourceTransactionReceipt) => void
}

export async function executeFileSystemReceiptLifecycle({
  cacheAdapter,
  apply,
  rollback,
  mutate,
  onOptimisticApplied,
  onMutationFailure,
  onSuccess,
  errorMessage,
  progressMessage,
  runMutation,
  reportError,
  showProgress,
  dismissProgress,
  showReceiptToast,
}: FileSystemReceiptLifecycleArgs): Promise<ResourceCommandResult<never>> {
  const receipt = await runMutation(() =>
    runFileSystemOptimisticMutation({
      cacheAdapter,
      apply,
      rollback,
      mutate,
      onOptimisticApplied,
      onMutationFailure,
      onSuccess: async (committedReceipt) => {
        await onSuccess(committedReceipt)
        try {
          showReceiptToast(committedReceipt)
        } catch (error) {
          reportError(error, 'Failed to show filesystem receipt')
        }
      },
      errorMessage,
      progressMessage,
      reportError,
      showProgress,
      dismissProgress,
    }),
  )

  return receipt ? { status: 'completed', receipt } : { status: 'error' }
}

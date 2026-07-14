import type { ResourceId, OperationId } from '../resources/domain-id'
import type { UserProfileId } from '../../../../shared/common/ids'
import type {
  ResourceCommand,
  ResourceCommandMutationInput,
  ResourceCommandResult,
  ResourceCreateParentPlan,
  ResourceTransactionReceipt,
} from './transaction-contract'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { FileSystemCacheAdapter } from './cache'
import { planFileSystemOptimisticCommand } from './optimistic-planner'
import { getCommandProgressToastText } from './progress-messages'
import { executeFileSystemReceiptLifecycle } from './receipt-lifecycle'
import { shouldRecordFileSystemUndo } from './undo-recording'

type ProgressToastId = string | number

type FileSystemCommandLifecycleArgs = {
  command: ResourceCommand
  createParentPlan?: ResourceCreateParentPlan
  workspaceId: string
  currentUserId: UserProfileId | null
  activeItemSurface: { parentId: ResourceId | null } | null
  cacheAdapter: FileSystemCacheAdapter
  createOperationId: () => OperationId
  getCurrentResourceId: () => ResourceId | null
  runMutation: <T>(operation: () => Promise<T>) => Promise<T>
  executeMutation: (args: ResourceCommandMutationInput) => Promise<ResourceTransactionReceipt>
  applyLifecycleIntents: (
    intents: Array<FileSystemLifecycleIntent>,
    previousResourceId: ResourceId | null,
  ) => Promise<void>
  applyReceiptSideEffects: (
    receipt: ResourceTransactionReceipt,
    currentResourceId: ResourceId | null,
  ) => Promise<void>
  recordUndoReceipt: (receipt: ResourceTransactionReceipt) => void
  onSuccess?: () => void
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
  showReceiptToast: (receipt: ResourceTransactionReceipt) => void
}

export async function executeFileSystemCommandLifecycle({
  command,
  createParentPlan,
  workspaceId,
  currentUserId,
  activeItemSurface,
  cacheAdapter,
  createOperationId,
  getCurrentResourceId,
  runMutation,
  executeMutation,
  applyLifecycleIntents,
  applyReceiptSideEffects,
  recordUndoReceipt,
  onSuccess,
  reportError,
  showProgress,
  dismissProgress,
  showReceiptToast,
}: FileSystemCommandLifecycleArgs): Promise<FileSystemCommandLifecycleResult> {
  return await runMutation(async () => {
    let plan: ReturnType<typeof planFileSystemOptimisticCommand>
    try {
      plan = planFileSystemOptimisticCommand({
        command,
        createParentPlan,
        snapshot: cacheAdapter.getSnapshot(),
        readModel: cacheAdapter.getReadModel(),
        activeItemSurface,
        currentUserId,
        workspaceId,
      })
    } catch (error) {
      reportError(error, 'Filesystem operation failed')
      return { status: 'error' }
    }
    if (plan.status === 'unavailable') return plan

    const previousResourceId = getCurrentResourceId()
    return await executeFileSystemReceiptLifecycle({
      cacheAdapter,
      apply: plan.preview.receiptPatches,
      rollback: plan.preview.inversePatches,
      onOptimisticApplied: () =>
        applyLifecycleIntents(plan.preview.optimisticIntents, previousResourceId),
      onMutationFailure: () =>
        applyLifecycleIntents(plan.preview.rollbackIntents, previousResourceId),
      mutate: () =>
        executeMutation({
          command,
          operationId: createOperationId(),
        }),
      progressMessage: getCommandProgressToastText(command),
      onSuccess: async (committedReceipt) => {
        if (shouldRecordFileSystemUndo(committedReceipt)) {
          recordUndoReceipt(committedReceipt)
        }
        await applyReceiptSideEffects(committedReceipt, previousResourceId)
        onSuccess?.()
      },
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress,
      dismissProgress,
      showReceiptToast,
      runMutation: (operation) => operation(),
    })
  })
}

type FileSystemCommandLifecycleResult = ResourceCommandResult

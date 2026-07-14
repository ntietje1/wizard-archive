import type { SidebarItemId, UserProfileId } from '../../../../shared/common/ids'
import type {
  ResourceCommand,
  ResourceCommandDecisionRecord,
  ResourceCommandMutationInput,
  ResourceCommandResult,
  ResourceCreateParentPlan,
  ResourceOperationDecision,
  ResourceTransactionReceipt,
} from './transaction-contract'
import type { ItemOperationConflict } from './operation-planner'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { FileSystemCacheAdapter } from './cache'
import { planFileSystemOptimisticCommand } from './optimistic-planner'
import { getCommandProgressToastText } from './progress-messages'
import { executeFileSystemReceiptLifecycle } from './receipt-lifecycle'
import { shouldRecordFileSystemUndo } from './undo-recording'
import type { OperationId } from '../resources/domain-id'

type ProgressToastId = string | number

type FileSystemCommandLifecycleArgs = {
  command: ResourceCommand
  createParentPlan?: ResourceCreateParentPlan
  decisions?: ResourceCommandDecisionRecord
  workspaceId: string
  currentUserId: UserProfileId | null
  activeItemSurface: { parentId: SidebarItemId | null } | null
  cacheAdapter: FileSystemCacheAdapter
  createOperationId: () => OperationId
  getCurrentResourceId: () => SidebarItemId | null
  runMutation: <T>(operation: () => Promise<T>) => Promise<T>
  executeMutation: (args: ResourceCommandMutationInput) => Promise<ResourceTransactionReceipt>
  applyLifecycleIntents: (
    intents: Array<FileSystemLifecycleIntent>,
    previousResourceId: SidebarItemId | null,
  ) => Promise<void>
  applyReceiptSideEffects: (
    receipt: ResourceTransactionReceipt,
    currentResourceId: SidebarItemId | null,
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
  decisions,
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
    let operationDecisions: Array<ResourceOperationDecision> | undefined
    let plan: ReturnType<typeof planFileSystemOptimisticCommand>
    try {
      operationDecisions = toDecisionArray(decisions)
      plan = planFileSystemOptimisticCommand({
        command,
        createParentPlan,
        decisions: operationDecisions,
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
    if (plan.status === 'needsDecision') {
      return { status: 'needsDecision', conflicts: plan.conflicts }
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
          decisions: operationDecisions,
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

type FileSystemCommandLifecycleResult = ResourceCommandResult<ItemOperationConflict>

function toDecisionArray(
  decisions?: ResourceCommandDecisionRecord,
): Array<ResourceOperationDecision> | undefined {
  if (!decisions) return undefined
  const result: Array<ResourceOperationDecision> = []
  for (const [sourceItemId, decision] of Object.entries(decisions)) {
    if (decision) {
      result.push({ sourceItemId: sourceItemId as SidebarItemId, action: decision.action })
    }
  }
  return result
}

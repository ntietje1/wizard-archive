import type { Id } from 'convex/_generated/dataModel'
import type {
  FileSystemCommand,
  FileSystemOperationDecision,
} from 'shared/sidebar-items/filesystem/commands'
import type {
  ConflictDecision,
  ItemOperationConflict,
} from 'shared/sidebar-items/filesystem/conflicts'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemLifecycleIntent } from 'shared/sidebar-items/filesystem/lifecycle'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SidebarOperationSurface } from './filesystem-targets'
import type { FileSystemCacheAdapter } from './filesystem-cache-adapter'
import { planFileSystemOptimisticCommand } from './filesystem-optimistic-planner'
import { runFileSystemOptimisticMutation } from './filesystem-optimistic-mutation-lifecycle'
import { getCommandProgressToastText } from './filesystem-progress-messages'
import { shouldRecordFileSystemUndo } from './filesystem-undo-store'

type ProgressToastId = string | number

type FileSystemCommandMutationArgs = {
  command: FileSystemCommand
  decisions: Array<FileSystemOperationDecision> | undefined
  clientOperationId: string
}

type FileSystemCommandLifecycleResult =
  | { status: 'completed'; receipt: FileSystemTransactionReceipt }
  | { status: 'needsDecision'; conflicts: Array<ItemOperationConflict> }
  | { status: 'failed' }

type FileSystemCommandLifecycleArgs = {
  command: FileSystemCommand
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  campaignId: Id<'campaigns'>
  currentUserId: Id<'userProfiles'> | null
  activeItemSurface: SidebarOperationSurface | null
  cacheAdapter: FileSystemCacheAdapter
  createClientOperationId: () => string
  getCurrentSlug: () => SidebarItemSlug | null
  runMutation: (
    operation: () => Promise<FileSystemTransactionReceipt | null>,
  ) => Promise<FileSystemTransactionReceipt | null>
  executeMutation: (args: FileSystemCommandMutationArgs) => Promise<FileSystemTransactionReceipt>
  applyLifecycleIntents: (
    intents: Array<FileSystemLifecycleIntent>,
    previousSlug: SidebarItemSlug | null,
  ) => Promise<void>
  applyReceiptSideEffects: (receipt: FileSystemTransactionReceipt) => Promise<void>
  recordUndoReceipt: (receipt: FileSystemTransactionReceipt) => void
  onSuccess?: () => void
  reportError: (error: unknown, message: string) => void
  showProgress: (message: string) => ProgressToastId
  dismissProgress: (toastId: ProgressToastId) => void
  showReceiptToast: (receipt: FileSystemTransactionReceipt) => void
}

export async function executeFileSystemCommandLifecycle({
  command,
  decisions,
  campaignId,
  currentUserId,
  activeItemSurface,
  cacheAdapter,
  createClientOperationId,
  getCurrentSlug,
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
  const plan = planFileSystemOptimisticCommand({
    command,
    decisions,
    snapshot: cacheAdapter.getSnapshot(),
    readModel: cacheAdapter.getReadModel(),
    activeItemSurface,
    currentUserId,
    campaignId,
  })
  if (plan.status === 'needsDecision') {
    return { status: 'needsDecision', conflicts: plan.conflicts }
  }

  const previousSlug = getCurrentSlug()
  const receipt = await runMutation(() =>
    runFileSystemOptimisticMutation({
      cacheAdapter,
      apply: plan.preview.receiptPatches,
      rollback: plan.preview.inversePatches,
      onOptimisticApplied: () =>
        applyLifecycleIntents(plan.preview.optimisticIntents, previousSlug),
      onMutationFailure: () => applyLifecycleIntents(plan.preview.rollbackIntents, previousSlug),
      mutate: () =>
        executeMutation({
          command,
          decisions: toDecisionArray(decisions),
          clientOperationId: createClientOperationId(),
        }),
      progressMessage: getCommandProgressToastText(command),
      onSuccess: async (committedReceipt) => {
        if (shouldRecordFileSystemUndo(committedReceipt)) {
          recordUndoReceipt(committedReceipt)
        }
        await applyReceiptSideEffects(committedReceipt)
        onSuccess?.()
        showReceiptToast(committedReceipt)
      },
      errorMessage: 'Filesystem operation failed',
      reportError,
      showProgress,
      dismissProgress,
    }),
  )

  return receipt ? { status: 'completed', receipt } : { status: 'failed' }
}

function toDecisionArray(
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
): Array<FileSystemOperationDecision> | undefined {
  if (!decisions) return undefined
  const result: Array<FileSystemOperationDecision> = []
  for (const [sourceItemId, decision] of Object.entries(decisions)) {
    if (decision) {
      result.push({ sourceItemId: sourceItemId as Id<'sidebarItems'>, action: decision.action })
    }
  }
  return result
}

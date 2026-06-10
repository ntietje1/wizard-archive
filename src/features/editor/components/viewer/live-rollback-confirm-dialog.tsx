import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { RollbackConfirmDialog } from './rollback-confirm-dialog'
import type { RollbackConfirmDialogState } from './rollback-confirm-dialog'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { handleError } from '~/shared/utils/logger'

export function LiveRollbackConfirmDialog({ itemId }: { itemId: Id<'sidebarItems'> }) {
  const rollbackEntryId = useHistoryPreviewStore((s) =>
    s.rollback?.itemId === itemId ? s.rollback.entryId : null,
  )
  const clearRollback = useHistoryPreviewStore((s) => s.clearRollback)
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)

  const historyEntry = useCampaignQuery(
    api.editHistory.queries.getHistoryEntry,
    rollbackEntryId ? { editHistoryId: rollbackEntryId } : 'skip',
  )
  const rollback = useCampaignMutation(api.documentSnapshots.mutations.rollbackToSnapshot)

  const state: RollbackConfirmDialogState =
    rollbackEntryId === null
      ? { status: 'closed', isRestoring: false }
      : historyEntry.error
        ? { status: 'error', isRestoring: rollback.isPending }
        : historyEntry.isLoading || !historyEntry.data
          ? { status: 'loading', isRestoring: rollback.isPending }
          : {
              status: 'ready',
              entryTime: historyEntry.data._creationTime,
              isRestoring: rollback.isPending,
            }

  const handleRestore = async () => {
    if (!rollbackEntryId || rollback.isPending) return
    try {
      await rollback.mutateAsync({ editHistoryId: rollbackEntryId })
      clearPreview(itemId)
      toast.success('Version restored')
      clearRollback(itemId)
    } catch (error) {
      handleError(error, 'Failed to restore version')
    }
  }

  return (
    <RollbackConfirmDialog
      state={state}
      onOpenChange={(open) => {
        if (!open && !rollback.isPending) clearRollback(itemId)
      }}
      onRestore={handleRestore}
    />
  )
}

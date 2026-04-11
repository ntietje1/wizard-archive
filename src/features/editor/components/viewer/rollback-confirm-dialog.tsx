import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { handleError } from '~/shared/utils/logger'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/features/shadcn/components/alert-dialog'

export function RollbackConfirmDialog() {
  const rollbackEntryId = useHistoryPreviewStore((s) => s.rollbackEntryId)
  const setRollbackEntryId = useHistoryPreviewStore((s) => s.setRollbackEntryId)
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)

  const historyEntry = useCampaignQuery(
    api.editHistory.queries.getHistoryEntry,
    rollbackEntryId ? { editHistoryId: rollbackEntryId } : 'skip',
  )

  const rollback = useCampaignMutation(api.documentSnapshots.mutations.rollbackToSnapshot)

  const handleRestore = async () => {
    if (!rollbackEntryId || rollback.isPending) return
    try {
      await rollback.mutateAsync({ editHistoryId: rollbackEntryId })
      clearPreview()
      toast.success('Version restored')
      setRollbackEntryId(null)
    } catch (error) {
      handleError(error, 'Failed to restore version')
    }
  }

  const entryTime = historyEntry.data?._creationTime
  const hasError = !!historyEntry.error
  const isReady = !historyEntry.isLoading && !!historyEntry.data

  return (
    <AlertDialog
      open={rollbackEntryId !== null}
      onOpenChange={(open) => {
        if (!open && !rollback.isPending) setRollbackEntryId(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasError ? (
              'Failed to load version details. Please close and try again.'
            ) : isReady ? (
              <>
                This will restore the document to its state from {formatRelativeTime(entryTime!)}.
                The current content will be preserved in the edit history.
              </>
            ) : (
              'Loading version details\u2026'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rollback.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={!isReady || hasError || rollback.isPending}
          >
            {rollback.isPending ? 'Restoring\u2026' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

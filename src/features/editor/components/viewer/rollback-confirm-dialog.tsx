import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
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

  const historyEntry = useAuthQuery(
    api.editHistory.queries.getHistoryEntry,
    rollbackEntryId ? { editHistoryId: rollbackEntryId } : 'skip',
  )

  const rollback = useAppMutation(
    api.documentSnapshots.mutations.rollbackToSnapshot,
  )

  const handleRestore = async () => {
    if (!rollbackEntryId || rollback.isPending) return
    try {
      await rollback.mutateAsync({ editHistoryId: rollbackEntryId })
      clearPreview()
      toast.success('Version restored')
    } catch (error) {
      handleError(error, 'Failed to restore version')
    } finally {
      setRollbackEntryId(null)
    }
  }

  const entryTime = historyEntry.data?._creationTime
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
            {isReady ? (
              <>
                This will restore the document to its state from{' '}
                {formatRelativeTime(entryTime!)}. The current content will be
                preserved in the edit history.
              </>
            ) : (
              'Loading version details\u2026'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rollback.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestore}
            disabled={!isReady || rollback.isPending}
          >
            {rollback.isPending ? 'Restoring\u2026' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

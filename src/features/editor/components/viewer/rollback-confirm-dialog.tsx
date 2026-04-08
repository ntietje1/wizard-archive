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
    if (!rollbackEntryId) return
    setRollbackEntryId(null)
    try {
      await rollback.mutateAsync({ editHistoryId: rollbackEntryId })
      clearPreview()
      toast.success('Version restored')
    } catch (error) {
      handleError(error, 'Failed to restore version')
    }
  }

  const entryTime = historyEntry.data?._creationTime

  return (
    <AlertDialog
      open={rollbackEntryId !== null}
      onOpenChange={(open) => {
        if (!open) setRollbackEntryId(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the document to its state from{' '}
            {entryTime ? formatRelativeTime(entryTime) : ''}. The current
            content will be preserved in the edit history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

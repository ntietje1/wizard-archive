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

export type RollbackConfirmDialogState =
  | { status: 'closed'; isRestoring: false }
  | { status: 'loading'; isRestoring: boolean }
  | { status: 'error'; isRestoring: boolean }
  | { status: 'ready'; entryTime: number; isRestoring: boolean }

export function RollbackConfirmDialog({
  onOpenChange,
  onRestore,
  state,
}: {
  onOpenChange: (open: boolean) => void
  onRestore: () => void
  state: RollbackConfirmDialogState
}) {
  const open = state.status !== 'closed'
  const hasError = state.status === 'error'
  const isReady = state.status === 'ready'
  const isRestoring = state.isRestoring

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasError ? (
              'Failed to load version details. Please close and try again.'
            ) : isReady ? (
              <>
                This will restore the document to its state from{' '}
                {formatRelativeTime(state.entryTime)}. The current content will be preserved in the
                edit history.
              </>
            ) : (
              'Loading version details\u2026'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRestore} disabled={!isReady || hasError || isRestoring}>
            {isRestoring ? 'Restoring\u2026' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

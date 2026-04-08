import { useState } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import { Button } from '~/features/shadcn/components/button'
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

export function HistoryPreviewBanner({
  entryId,
  entryTime,
  canEdit,
}: {
  entryId: Id<'editHistory'>
  entryTime: number
  canEdit: boolean
}) {
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)
  const [showConfirm, setShowConfirm] = useState(false)
  const rollback = useAppMutation(
    api.documentSnapshots.mutations.rollbackToSnapshot,
  )

  const handleRestore = async () => {
    setShowConfirm(false)
    try {
      await rollback.mutateAsync({ editHistoryId: entryId })
      clearPreview()
      toast.success('Version restored')
    } catch (error) {
      handleError(error, 'Failed to restore version')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 h-8 border-b border-primary/40 bg-accent text-accent-foreground shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <History className="h-3.5 w-3.5" />
          <span>
            Previewing version from{' '}
            <span className="font-semibold">
              {formatRelativeTime(entryTime)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs"
              onClick={() => setShowConfirm(true)}
              disabled={rollback.isPending}
            >
              <RotateCcw className="h-3 w-3 mr-0.5" />
              Restore
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={clearPreview}
            disabled={rollback.isPending}
          >
            <X className="h-3 w-3 mr-0.5" />
            Exit
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the document to its state from{' '}
              {formatRelativeTime(entryTime)}. The current content will be
              preserved in the edit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

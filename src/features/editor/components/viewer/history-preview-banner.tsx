import { History, RotateCcw, X } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import { Button } from '~/features/shadcn/components/button'

export function HistoryPreviewBanner({
  entryId,
  entryTime,
  canEdit,
}: {
  entryId: Id<'editHistory'>
  entryTime: number | undefined
  canEdit: boolean
}) {
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)
  const setRollbackEntryId = useHistoryPreviewStore((s) => s.setRollbackEntryId)

  return (
    <div className="flex items-center justify-between px-3 h-8 border-b border-primary/40 bg-accent text-accent-foreground shrink-0">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <History className="h-3.5 w-3.5" />
        <span>
          {entryTime != null ? (
            <>
              Previewing version from{' '}
              <span className="font-semibold">
                {formatRelativeTime(entryTime)}
              </span>
            </>
          ) : (
            'Previewing version'
          )}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={() => setRollbackEntryId(entryId)}
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
          aria-label="Exit history preview"
        >
          <X className="h-3 w-3 mr-0.5" />
          Exit
        </Button>
      </div>
    </div>
  )
}

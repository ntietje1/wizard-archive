import { History, RotateCcw, X } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import { useHistoryPreviewStore } from '~/features/editor/stores/history-preview-store'
import { formatRelativeTime } from '~/shared/utils/format-relative-time'
import { Banner, BannerButton } from '~/shared/components/banner'

export function HistoryPreviewBanner({
  itemId,
  entryId,
  entryTime,
  canEdit,
}: {
  itemId: Id<'sidebarItems'>
  entryId: Id<'editHistory'>
  entryTime: number | undefined
  canEdit: boolean
}) {
  const clearPreview = useHistoryPreviewStore((s) => s.clearPreview)
  const setRollbackEntry = useHistoryPreviewStore((s) => s.setRollbackEntry)

  return (
    <Banner
      icon={<History className="h-3.5 w-3.5" />}
      actions={
        <>
          {canEdit && (
            <BannerButton onClick={() => setRollbackEntry(itemId, entryId)}>
              <RotateCcw className="h-3 w-3 mr-0.5" />
              Restore
            </BannerButton>
          )}
          <BannerButton onClick={() => clearPreview(itemId)}>
            <X className="h-3 w-3 mr-0.5" />
            Exit
          </BannerButton>
        </>
      }
    >
      {entryTime != null ? (
        <>
          Previewing version from{' '}
          <span className="font-semibold">{formatRelativeTime(entryTime)}</span>
        </>
      ) : (
        'Previewing version'
      )}
    </Banner>
  )
}

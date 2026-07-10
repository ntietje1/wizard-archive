import { History, RotateCcw, X } from 'lucide-react'
import { formatRelativeTime } from '@wizard-archive/ui/utils/format-relative-time'
import { Banner, BannerButton } from '@wizard-archive/ui/components/banner'

export function HistoryPreviewBanner({
  canEdit,
  entryTime,
  onExit,
  onRestore,
}: {
  canEdit: boolean
  entryTime: number | undefined
  onExit: () => void
  onRestore: () => void
}) {
  return (
    <Banner
      icon={<History className="h-3.5 w-3.5" />}
      actions={
        <>
          {canEdit && (
            <BannerButton onClick={onRestore}>
              <RotateCcw className="h-3 w-3 mr-0.5" />
              Restore
            </BannerButton>
          )}
          <BannerButton onClick={onExit}>
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

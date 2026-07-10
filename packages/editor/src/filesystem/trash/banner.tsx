import { RotateCcw, Trash2 } from 'lucide-react'
import { TRASH_RETENTION_DAYS } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import { handleError } from '../../errors/handle-error'
import { reportResourceCommandFailure } from '../report-command-result'
import { Banner, BannerButton } from '@wizard-archive/ui/components/banner'
import { getSidebarItemTypeLabel } from '../../workspace/sidebar/item-type-label'
import type { TrashSource } from './source'

type TrashBannerSource = Pick<
  TrashSource,
  | 'canDeleteItemForever'
  | 'canEmptyTrash'
  | 'canRestoreItem'
  | 'getDeletedByName'
  | 'requestDeleteItemsForever'
  | 'requestEmptyTrash'
  | 'restoreItems'
>

function daysAgo(timestamp: number): number {
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)))
}

interface TrashBannerProps {
  item?: AnyItem
  source: TrashBannerSource
}

export function TrashBanner({ item, source }: TrashBannerProps) {
  if (item) {
    return <ItemTrashBanner item={item} source={source} />
  }
  return <RootTrashBanner source={source} />
}

function ItemTrashBanner({ item, source }: { item: AnyItem; source: TrashBannerSource }) {
  const isDeleted = item.isTrashed
  if (!isDeleted) return null

  const canRestore = source.canRestoreItem(item)
  const canDeleteForever = source.canDeleteItemForever(item)

  const deletionTime = item.deletionTime
  const deletedById = item.deletedBy
  const deletedByName = source.getDeletedByName(deletedById)

  const message = (() => {
    if (!deletionTime) return 'This item is in the trash'

    const days = daysAgo(deletionTime)
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - days)
    const typeLabel = getSidebarItemTypeLabel(item.type).toLowerCase()

    const who = deletedByName ?? 'Someone'
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
    const autoDelete =
      daysLeft <= 0
        ? 'It will be automatically deleted soon.'
        : daysLeft === 1
          ? 'It will be automatically deleted in 1 day.'
          : `It will be automatically deleted in ${daysLeft} days.`

    return `${who} moved this ${typeLabel} to the Trash ${when}. ${autoDelete}`
  })()

  const handleRestore = async () => {
    try {
      const result = await source.restoreItems([item.id], null)
      reportResourceCommandFailure(result, 'Failed to restore item')
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = async () => {
    try {
      await source.requestDeleteItemsForever([item.id])
    } catch (error) {
      handleError(error, 'Failed to delete item from trash')
    }
  }

  const actions =
    canRestore || canDeleteForever ? (
      <>
        {canRestore && (
          <BannerButton variant="on-destructive" onClick={handleRestore}>
            <RotateCcw className="size-3 mr-0.5" />
            Restore
          </BannerButton>
        )}
        {canDeleteForever && (
          <BannerButton variant="destructive" onClick={handlePermanentDelete}>
            <Trash2 className="size-3 mr-0.5" />
            Delete from Trash
          </BannerButton>
        )}
      </>
    ) : undefined

  return (
    <div className="overflow-hidden fade-in-delayed-fast">
      <Banner
        icon={<Trash2 className="size-3.5 shrink-0" />}
        variant="destructive"
        actions={actions}
      >
        {message}
      </Banner>
    </div>
  )
}

function RootTrashBanner({ source }: { source: TrashBannerSource }) {
  return (
    <Banner
      icon={<Trash2 className="size-3.5 shrink-0" />}
      variant="destructive"
      actions={source.canEmptyTrash() ? <EmptyTrashButton source={source} /> : undefined}
    >
      {`Items older than ${TRASH_RETENTION_DAYS} days are automatically deleted`}
    </Banner>
  )
}

function EmptyTrashButton({ source }: { source: TrashBannerSource }) {
  const handleEmptyTrash = async () => {
    try {
      await source.requestEmptyTrash()
    } catch (error) {
      handleError(error, 'Failed to empty trash')
    }
  }

  return (
    <BannerButton variant="destructive" onClick={handleEmptyTrash}>
      Empty Trash
    </BannerButton>
  )
}

import { useState } from 'react'
import { toast } from 'sonner'
import { TRASH_RETENTION_DAYS } from 'convex/common/constants'
import { RotateCcw, Trash2 } from 'lucide-react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { handleError } from '~/shared/utils/logger'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { Banner, BannerButton } from '~/shared/components/banner'
import { useEmptyTrashBin } from '~/features/sidebar/hooks/useEmptyTrashBin'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { getItemTypeLabel } from '~/features/sidebar/utils/sidebar-item-utils'
import { emptyTrashDescription } from '~/features/sidebar/utils/trash-utils'
import { useSidebarItemOperations } from '~/features/sidebar/operations/useSidebarItemOperations'

function daysAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function useDeletedByName(deletedById: Id<'userProfiles'> | null) {
  const { campaign } = useCampaign()
  const { data: members } = useCampaignMembers()

  if (!deletedById) return undefined

  const dmProfile = campaign.data?.dmUserProfile
  if (dmProfile && dmProfile._id === deletedById) {
    return dmProfile.name || dmProfile.username
  }

  const member = members?.find((mem) => mem.userProfile._id === deletedById)
  if (member) {
    return member.userProfile.name || member.userProfile.username
  }

  return 'Someone'
}

interface TrashBannerProps {
  item?: AnySidebarItem
}

export function TrashBanner({ item }: TrashBannerProps) {
  if (item) {
    return <ItemTrashBanner item={item} />
  }
  return <RootTrashBanner />
}

function ItemTrashBanner({ item }: { item: AnySidebarItem }) {
  const isDeleted = item.location === SIDEBAR_ITEM_LOCATION.trash
  const itemOperations = useSidebarItemOperations()

  const deletionTime = item.deletionTime
  const deletedById = item.deletedBy
  const deletedByName = useDeletedByName(deletedById)

  const message = (() => {
    if (!deletionTime) return 'This item is in the trash'

    const days = daysAgo(deletionTime)
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - days)
    const typeLabel = getItemTypeLabel(item.type).toLowerCase()

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
      const movedIds = await itemOperations.restoreItems([item])
      if (movedIds.length > 0) toast.success('Item restored')
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = () => {
    try {
      itemOperations.confirmPermanentDeleteItems([item])
    } catch (error) {
      handleError(error, 'Failed to delete item')
    }
  }

  return (
    <>
      {isDeleted && (
        <div className="overflow-hidden fade-in-delayed-fast">
          <Banner
            icon={<Trash2 className="size-3.5 shrink-0" />}
            variant="destructive"
            actions={
              <>
                <BannerButton onClick={handleRestore}>
                  <RotateCcw className="size-3 mr-0.5" />
                  Restore
                </BannerButton>
                <BannerButton variant="destructive" onClick={handlePermanentDelete}>
                  <Trash2 className="size-3 mr-0.5" />
                  Delete from Trash
                </BannerButton>
              </>
            }
          >
            {message}
          </Banner>
        </div>
      )}
    </>
  )
}

function RootTrashBanner() {
  const { isDm } = useCampaign()

  return (
    <Banner
      icon={<Trash2 className="size-3.5 shrink-0" />}
      variant="destructive"
      actions={isDm ? <EmptyTrashButton /> : undefined}
    >
      {`Items older than ${TRASH_RETENTION_DAYS} days are automatically deleted`}
    </Banner>
  )
}

function EmptyTrashButton() {
  const { campaignId } = useCampaign()
  const { emptyTrashBin } = useEmptyTrashBin()
  const { data: allTrashedItems = [] } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const handleEmptyTrash = async () => {
    if (!campaignId) return

    try {
      await emptyTrashBin()
      toast.success('Trash emptied')
    } catch (error) {
      handleError(error, 'Failed to empty trash')
    }
    setConfirmEmptyTrash(false)
  }

  return (
    <>
      <BannerButton variant="destructive" onClick={() => setConfirmEmptyTrash(true)}>
        Empty Trash
      </BannerButton>
      {confirmEmptyTrash && (
        <ConfirmationDialog
          isOpen={true}
          onClose={() => setConfirmEmptyTrash(false)}
          onConfirm={handleEmptyTrash}
          title="Empty Trash"
          description={emptyTrashDescription(allTrashedItems.length)}
          confirmLabel="Empty Trash"
          confirmVariant="destructive"
        />
      )}
    </>
  )
}

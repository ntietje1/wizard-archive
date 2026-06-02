import { RotateCcw, Trash2 } from 'lucide-react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { TRASH_RETENTION_DAYS } from 'shared/sidebar-items/trash-policy'
import { handleError } from '~/shared/utils/logger'
import { Banner, BannerButton } from '~/shared/components/banner'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'
import { getItemTypeLabel } from '~/features/sidebar/utils/sidebar-item-utils'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import { getUserDisplayName } from '~/shared/utils/user-display-name'

function daysAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function useDeletedByName(deletedById: Id<'userProfiles'> | null) {
  const { campaign } = useCampaign()
  const { data: members } = useCampaignMembers()

  if (!deletedById) return undefined

  const dmProfile = campaign.data?.dmUserProfile
  if (dmProfile && dmProfile._id === deletedById) {
    return getUserDisplayName(dmProfile, 'Someone')
  }

  const member = members?.find((mem) => mem.userProfile._id === deletedById)
  if (member) {
    return getUserDisplayName(member.userProfile, 'Someone')
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
  const isDeleted = item.isTrashed
  const filesystem = useFileSystem()

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
      await filesystem.restoreItems([item._id], null)
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = () => {
    filesystem.confirmDeleteForever([item._id])
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
                <BannerButton variant="on-destructive" onClick={handleRestore}>
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
  const filesystem = useFileSystem()

  return (
    <BannerButton
      variant="destructive"
      disabled={!campaignId}
      onClick={() => filesystem.confirmEmptyTrash()}
    >
      Empty Trash
    </BannerButton>
  )
}

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { Button } from '~/components/shadcn/ui/button'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { useCampaign } from '~/hooks/useCampaign'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { getItemTypeLabel } from '~/lib/sidebar-item-utils'
import { emptyTrashDescription, permanentDeleteDescription } from '~/lib/trash-utils'
import { TRASH_RETENTION_DAYS } from 'convex/common/constants'
import { RotateCcw, Trash2 } from '~/lib/icons'

function daysAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function useDeletedByName(deletedById: Id<'userProfiles'> | undefined) {
  const { campaign } = useCampaign()
  const { data: members } = useCampaignMembers()

  return useMemo(() => {
    if (!deletedById) return undefined

    // Check DM profile
    const dmProfile = campaign.data?.dmUserProfile
    if (dmProfile && dmProfile._id === deletedById) {
      return dmProfile.name || dmProfile.username
    }

    // Check campaign members
    const member = members?.find((m) => m.userProfile._id === deletedById)
    if (member) {
      return member.userProfile.name || member.userProfile.username
    }

    return 'Someone'
  }, [deletedById, campaign.data?.dmUserProfile, members])
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

/**
 * Banner for viewing a specific trashed item.
 * Shows who deleted it, when, and how long until auto-deletion.
 */
function ItemTrashBanner({ item }: { item: AnySidebarItem }) {
  const isDeleted = !!item.deletionTime
  const { moveItem, permanentlyDeleteItem } = useSidebarItemMutations()
  const { clearEditorContent } = useEditorNavigation()
  const { parentItemsMap: trashedParentItemsMap } = useTrashedSidebarItems()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deletionTime = item.deletionTime
  const deletedById = item.deletedBy
  const deletedByName = useDeletedByName(deletedById)

  const message = useMemo(() => {
    if (!deletionTime) return 'This item is in the trash'

    const days = daysAgo(deletionTime)
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - days)
    const typeLabel = getItemTypeLabel(item.type).toLowerCase()

    const who = deletedByName ?? 'Someone'
    const when =
      days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
    const autoDelete =
      daysLeft <= 0
        ? 'It will be automatically deleted soon.'
        : daysLeft === 1
          ? 'It will be automatically deleted in 1 day.'
          : `It will be automatically deleted in ${daysLeft} days.`

    return `${who} moved this ${typeLabel} to the Trash ${when}. ${autoDelete}`
  }, [deletionTime, deletedByName, item.type])

  const handleRestore = async () => {
    try {
      await moveItem(item, { deleted: false })
      toast.success('Item restored')
    } catch (error) {
      console.error(error)
      toast.error('Failed to restore item')
    }
  }

  const handlePermanentDelete = async () => {
    try {
      await permanentlyDeleteItem(item)
      toast.success('Item permanently deleted')
      clearEditorContent()
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete item')
    } finally {
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {isDeleted && (
          <motion.div
            key="deleted-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
            className="overflow-hidden"
          >
            <BannerBar
              message={message}
              actions={
                <>
                  <BannerButton onClick={handleRestore}>
                    <RotateCcw className="h-3 w-3 mr-0.5" />
                    Restore
                  </BannerButton>
                  <BannerButton onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3 w-3 mr-0.5" />
                    Delete from Trash
                  </BannerButton>
                </>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {confirmDelete && (
        <ConfirmationDialog
          isOpen={true}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handlePermanentDelete}
          title="Permanently Delete"
          description={permanentDeleteDescription(item, trashedParentItemsMap)}
          confirmLabel="Delete Forever"
          confirmVariant="destructive"
        />
      )}
    </>
  )
}

/**
 * Banner for the root trash view (no specific item).
 * Shows auto-deletion notice and "Empty Trash" button.
 */
function RootTrashBanner() {
  const { isDm } = useCampaign()

  return (
    <BannerBar
      message={`Items older than ${TRASH_RETENTION_DAYS} days are automatically deleted`}
      actions={isDm ? <EmptyTrashButton /> : undefined}
    />
  )
}

function EmptyTrashButton() {
  const { campaignId } = useCampaign()
  const { emptyTrashBin } = useSidebarItemMutations()
  const { data: allTrashedItems = [] } = useTrashedSidebarItems()
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const handleEmptyTrash = async () => {
    if (!campaignId) return

    try {
      await emptyTrashBin()
      toast.success('Trash emptied')
    } catch (error) {
      console.error(error)
      toast.error('Failed to empty trash')
    } finally {
      setConfirmEmptyTrash(false)
    }
  }

  return (
    <>
      <BannerButton onClick={() => setConfirmEmptyTrash(true)}>
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

function BannerBar({
  message,
  actions,
}: {
  message: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 h-8 border-b border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20 dark:border-destructive/60 dark:text-destructive/70">
      <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      {actions && (
        <div className="flex items-center gap-1 shrink-0">{actions}</div>
      )}
    </div>
  )
}

function BannerButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/15"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

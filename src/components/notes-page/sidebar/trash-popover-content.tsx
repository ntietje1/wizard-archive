import { useCallback, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { TRASH_RETENTION_DAYS } from 'convex/common/constants'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Button, buttonVariants } from '~/components/shadcn/ui/button'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { useCampaign } from '~/hooks/useCampaign'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'
import { useTrashedSidebarItems } from '~/hooks/useSidebarItems'
import { useDraggable } from '~/hooks/useDraggable'
import { getSidebarItemIcon } from '~/lib/category-icons'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/lib/trash-utils'
import { EDITOR_ROUTE, useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { RotateCcw, SquareArrowOutUpRight, Trash2 } from '~/lib/icons'

interface TrashPopoverContentProps {
  onClose: () => void
}

export function TrashPopoverContent({ onClose }: TrashPopoverContentProps) {
  const { campaignId, isDm, dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const { data: allTrashedItems, parentItemsMap } = useTrashedSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []

  const { moveItem, permanentlyDeleteItem, emptyTrashBin } =
    useSidebarItemMutations()

  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<AnySidebarItem | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const handleRestore = useCallback(
    async (item: AnySidebarItem) => {
      try {
        await moveItem(item, { deleted: false })
        toast.success('Item restored')
      } catch (error) {
        console.error(error)
        toast.error('Failed to restore item')
      }
    },
    [moveItem],
  )

  const handlePermanentDelete = useCallback(
    async (item: AnySidebarItem) => {
      try {
        await permanentlyDeleteItem(item)
        toast.success('Item permanently deleted')
      } catch (error) {
        console.error(error)
        toast.error('Failed to delete item')
      } finally {
        setConfirmDeleteItem(null)
      }
    },
    [permanentlyDeleteItem],
  )

  const handleEmptyTrash = useCallback(async () => {
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
  }, [campaignId, emptyTrashBin])

  const handleItemClick = useCallback(
    (item: AnySidebarItem) => {
      setLastSelectedItem({ type: item.type, slug: item.slug })
      onClose()
    },
    [setLastSelectedItem, onClose],
  )

  const getDeletionTimeLabel = (item: AnySidebarItem) => {
    const dt = item.deletionTime
    if (!dt) return ''
    return new Date(dt).toLocaleDateString()
  }

  return (
    <div className="relative flex flex-col w-72">
      {/* Open full page link */}
      <Link
        to={EDITOR_ROUTE}
        params={{ dmUsername, campaignSlug }}
        search={{ trash: true }}
        className={buttonVariants({
          variant: 'ghost',
          size: 'icon',
          className: 'absolute top-0 right-0 h-6 w-6 text-muted-foreground',
        })}
        onClick={onClose}
        title="Open full page"
      >
        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
      </Link>

      {/* Header */}
      <div className="px-2 pb-1.5">
        <span className="text-sm font-medium">Trash</span>
      </div>

      {/* Item list */}
      <ScrollArea className="max-h-[300px]">
        <div className="px-1">
          {rootTrashedItems.map((item) => (
            <TrashPopoverItem
              key={item._id}
              item={item}
              onRestore={handleRestore}
              onPermanentDelete={setConfirmDeleteItem}
              onClick={handleItemClick}
              deletionTimeLabel={getDeletionTimeLabel(item)}
            />
          ))}

          {rootTrashedItems.length === 0 && (
            <div className="flex flex-col gap-2 py-6 text-muted-foreground items-center text-sm text-center">
              Trash is empty
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t mt-1.5 pt-1.5 px-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground leading-tight">
          Items older than {TRASH_RETENTION_DAYS} days are automatically
          deleted.
        </p>
        {isDm && rootTrashedItems.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive h-6 px-2 shrink-0"
            onClick={() => setConfirmEmptyTrash(true)}
          >
            Empty Trash
          </Button>
        )}
      </div>

      {confirmDeleteItem && (
        <ConfirmationDialog
          isOpen={true}
          onClose={() => setConfirmDeleteItem(null)}
          onConfirm={() => handlePermanentDelete(confirmDeleteItem)}
          title="Permanently Delete"
          description={permanentDeleteDescription(
            confirmDeleteItem,
            parentItemsMap,
          )}
          confirmLabel="Delete Forever"
          confirmVariant="destructive"
        />
      )}

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
    </div>
  )
}

function TrashPopoverItem({
  item,
  onRestore,
  onPermanentDelete,
  onClick,
  deletionTimeLabel,
}: {
  item: AnySidebarItem
  onRestore: (item: AnySidebarItem) => void
  onPermanentDelete: (item: AnySidebarItem) => void
  onClick: (item: AnySidebarItem) => void
  deletionTimeLabel: string
}) {
  const Icon = getSidebarItemIcon(item)
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(item)

  useDraggable({
    ref,
    data: { sidebarItemId: item._id },
    canDrag: true,
  })

  return (
    <div
      ref={ref}
      className="flex items-center w-full py-1 px-1 rounded-sm hover:bg-muted/70 group min-w-0"
    >
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        draggable={false}
        className="flex items-center gap-1.5 flex-1 min-w-0 h-full"
        onClick={() => onClick(item)}
      >
        <div className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground truncate leading-none">
            Deleted {deletionTimeLabel}
          </div>
        </div>
      </Link>
      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm"
          onClick={() => onRestore(item)}
          title="Restore"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted-foreground/10 rounded-sm"
          onClick={() => onPermanentDelete(item)}
          title="Delete forever"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

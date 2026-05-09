import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { TRASH_RETENTION_DAYS } from 'convex/common/constants'
import { RotateCcw, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { handleError } from '~/shared/utils/logger'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { ConfirmationDialog } from '~/shared/components/confirmation-dialog'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useEmptyTrashBin } from '~/features/sidebar/hooks/useEmptyTrashBin'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemOperations } from '~/features/sidebar/operations/useSidebarItemOperations'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'
import { cn } from '~/features/shadcn/lib/utils'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/features/sidebar/utils/trash-utils'
import { EDITOR_ROUTE, useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import {
  sidebarItemActionButtonClass,
  sidebarItemActionGroupClass,
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'

interface TrashPopoverContentProps {
  onClose: () => void
}

export function TrashPopoverContent({ onClose }: TrashPopoverContentProps) {
  const { campaignId, isDm, dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const { data: allTrashedItems, parentItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const visibleItemIds = rootTrashedItems.map((item) => item._id)
  const { activateSurface, handleSurfacePointerDown } = useItemSurfaceRegistration({
    surface: 'trash',
    parentId: null,
    visibleItemIds,
  })

  const { emptyTrashBin } = useEmptyTrashBin()
  const itemOperations = useSidebarItemOperations()

  const [confirmDeleteItem, setConfirmDeleteItem] = useState<AnySidebarItem | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const handleRestore = async (item: AnySidebarItem) => {
    try {
      const movedIds = await itemOperations.restoreItems([item])
      if (movedIds.length > 0) toast.success('Item restored')
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = async (item: AnySidebarItem) => {
    try {
      await itemOperations.permanentlyDeleteItems([item])
    } catch (error) {
      handleError(error, 'Failed to delete item')
    }
    setConfirmDeleteItem(null)
  }

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

  const handleItemClick = (item: AnySidebarItem) => {
    setLastSelectedItem(item.slug)
  }

  const getDeletionTimeLabel = (item: AnySidebarItem) => {
    const dt = item.deletionTime
    if (!dt) return ''
    return new Date(dt).toLocaleDateString()
  }

  return (
    <div className="relative flex flex-col w-72">
      <Link
        to={EDITOR_ROUTE}
        params={{ dmUsername, campaignSlug }}
        search={{ trash: true }}
        className={buttonVariants({
          variant: 'ghost',
          size: 'icon',
          className: 'absolute top-0 right-0 size-6 text-muted-foreground',
        })}
        onClick={onClose}
        title="Open full page"
      >
        <SquareArrowOutUpRight className="size-3.5" />
      </Link>

      <div className="px-2 pb-1.5">
        <span className="text-sm font-medium">Trash</span>
      </div>

      <ScrollArea
        className="max-h-[300px]"
        onFocusCapture={activateSurface}
        onPointerDownCapture={handleSurfacePointerDown}
        onContextMenuCapture={activateSurface}
      >
        <div className="px-1">
          {rootTrashedItems.map((item) => (
            <TrashPopoverItem
              key={item._id}
              item={item}
              onRestore={handleRestore}
              onPermanentDelete={setConfirmDeleteItem}
              onClick={handleItemClick}
              deletionTimeLabel={getDeletionTimeLabel(item)}
              visibleItemIds={visibleItemIds}
            />
          ))}

          {rootTrashedItems.length === 0 && (
            <div className="flex flex-col gap-2 py-6 text-muted-foreground items-center text-sm text-center">
              Trash is empty
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t mt-1.5 pt-1.5 px-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground leading-tight">
          Items older than {TRASH_RETENTION_DAYS} days are automatically deleted.
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
          description={permanentDeleteDescription(confirmDeleteItem, allTrashedItems)}
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
  visibleItemIds,
}: {
  item: AnySidebarItem
  onRestore: (item: AnySidebarItem) => void
  onPermanentDelete: (item: AnySidebarItem) => void
  onClick: (item: AnySidebarItem) => void
  deletionTimeLabel: string
  visibleItemIds: Array<AnySidebarItem['_id']>
}) {
  const Icon = getSidebarItemIcon(item)
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(item)
  const dragData = useSidebarDragData(item)
  const visualState = useSidebarItemVisualState(item)
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: 'trash',
    parentId: null,
    visibleItemIds,
  })

  useDraggable({
    ref,
    data: dragData,
    canDrag: true,
  })

  return (
    <div
      ref={ref}
      data-testid={`trash-item-${item.name}`}
      data-item-selection-target="true"
      className={cn(
        'flex items-center w-full py-1 px-1 rounded-sm group min-w-0',
        sidebarItemBackgroundClass(visualState),
      )}
      onContextMenu={handleItemContextMenu}
    >
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        draggable={false}
        className="flex items-center gap-1.5 flex-1 min-w-0 h-full"
        onClick={(event) => {
          handleItemClick(event, () => onClick(item))
        }}
      >
        <div
          className={cn(
            'size-6 shrink-0 flex items-center justify-center',
            sidebarItemIconClass(visualState),
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm truncate', sidebarItemNameClass(visualState))}>
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground truncate leading-none">
            Deleted {deletionTimeLabel}
          </div>
        </div>
      </Link>
      <div className={sidebarItemActionGroupClass()}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-6 p-0 hover:bg-muted-foreground/10 rounded-sm',
            sidebarItemActionButtonClass(visualState),
          )}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleItemContextMenu(event)
            onRestore(item)
          }}
          aria-label="Restore"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'size-6 p-0 hover:text-destructive hover:bg-muted-foreground/10 rounded-sm',
            sidebarItemActionButtonClass(visualState),
          )}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleItemContextMenu(event)
            onPermanentDelete(item)
          }}
          aria-label="Delete forever"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

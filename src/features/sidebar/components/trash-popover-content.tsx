import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
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
import { useDeleteSidebarItem } from '~/features/sidebar/hooks/useDeleteSidebarItem'
import { useMoveSidebarItem } from '~/features/sidebar/hooks/useMoveSidebarItem'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { isItemSurfaceInteractionTarget } from '~/features/sidebar/utils/item-surface-hotkeys'
import { cn } from '~/features/shadcn/lib/utils'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import {
  emptyTrashDescription,
  permanentDeleteDescription,
} from '~/features/sidebar/utils/trash-utils'
import { EDITOR_ROUTE, useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'

interface TrashPopoverContentProps {
  onClose: () => void
}

export function TrashPopoverContent({ onClose }: TrashPopoverContentProps) {
  const { campaignId, isDm, dmUsername, campaignSlug } = useCampaign()
  const { setLastSelectedItem } = useLastEditorItem()

  const { data: allTrashedItems, parentItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const rootTrashedItems = useMemo(() => parentItemsMap.get(null) ?? [], [parentItemsMap])
  const visibleItemIds = useMemo(() => rootTrashedItems.map((item) => item._id), [rootTrashedItems])
  const setActiveItemSurface = useSidebarUIStore((s) => s.setActiveItemSurface)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)

  const activateTrashSurface = () => {
    setActiveItemSurface({ surface: 'trash', parentId: null, visibleItemIds })
  }

  const handleSurfacePointerDown = (event: PointerEvent) => {
    activateTrashSurface()
    if (!isItemSurfaceInteractionTarget(event.target)) {
      clearItemSelection()
    }
  }

  const { moveItem } = useMoveSidebarItem()
  const { permanentlyDeleteItem, emptyTrashBin } = useDeleteSidebarItem()

  const [confirmDeleteItem, setConfirmDeleteItem] = useState<AnySidebarItem | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)

  const handleRestore = async (item: AnySidebarItem) => {
    try {
      await moveItem(item, { location: SIDEBAR_ITEM_LOCATION.sidebar })
      toast.success('Item restored')
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = async (item: AnySidebarItem) => {
    try {
      await permanentlyDeleteItem(item)
      toast.success('Item permanently deleted')
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
      <ScrollArea
        className="max-h-[300px]"
        onFocusCapture={activateTrashSurface}
        onPointerDownCapture={handleSurfacePointerDown}
        onContextMenuCapture={activateTrashSurface}
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

      {/* Footer */}
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
  const isSelected = useIsSelectedItem(item)
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
        'flex items-center w-full py-1 px-1 rounded-sm hover:bg-muted/70 group min-w-0',
        isSelected && 'bg-muted ring-1 ring-ring',
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
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleItemContextMenu()
            onRestore(item)
          }}
          aria-label="Restore"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted-foreground/10 rounded-sm"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleItemContextMenu()
            onPermanentDelete(item)
          }}
          aria-label="Delete forever"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

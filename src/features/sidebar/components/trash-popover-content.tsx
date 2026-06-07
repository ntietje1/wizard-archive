import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { RotateCcw, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { TRASH_RETENTION_DAYS } from 'shared/sidebar-items/trash-policy'
import { handleError } from '~/shared/utils/logger'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useTrashSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import {
  canDeleteSidebarItemsForever,
  canRestoreSidebarItems,
} from '~/features/filesystem/filesystem-capabilities'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'
import { cn } from '~/features/shadcn/lib/utils'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
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

function getDeletionTimeLabel(item: AnySidebarItem) {
  const dt = item.deletionTime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString()
}

export function TrashPopoverContent({ onClose }: TrashPopoverContentProps) {
  const { isDm, dmUsername, campaignSlug, campaign } = useCampaign()
  const memberRole = campaign.data?.myMembership?.role
  const { setLastSelectedItem } = useLastEditorItem()

  const { parentItemsMap } = useTrashSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const visibleItemIds = rootTrashedItems.map((item) => item._id)
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
      surface: 'trash',
      parentId: null,
      visibleItemIds,
    })

  const filesystem = useFileSystem()

  const handleRestore = async (item: AnySidebarItem) => {
    try {
      await filesystem.restoreItems([item._id], null)
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = (item: AnySidebarItem) => {
    try {
      filesystem.confirmDeleteForever([item._id])
    } catch (error) {
      handleError(error, 'Failed to permanently delete item')
    }
  }

  const handleItemClick = (item: AnySidebarItem) => {
    setLastSelectedItem(item.slug)
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
        className="group/sidebar-surface max-h-[300px]"
        onFocusCapture={activateSurface}
        onPointerDownCapture={handleSurfacePointerDown}
        onContextMenuCapture={activateSurface}
        {...itemSurfaceHotkeyProps}
      >
        <div className="px-1">
          {rootTrashedItems.map((item) => (
            <TrashPopoverItem
              key={item._id}
              item={item}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
              onClick={handleItemClick}
              deletionTimeLabel={getDeletionTimeLabel(item)}
              visibleItemIds={visibleItemIds}
              canRestore={canRestoreSidebarItems(memberRole, [item])}
              canDeleteForever={canDeleteSidebarItemsForever(memberRole, [item])}
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
            onClick={() => filesystem.confirmEmptyTrash()}
          >
            Empty Trash
          </Button>
        )}
      </div>
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
  canRestore,
  canDeleteForever,
}: {
  item: AnySidebarItem
  onRestore: (item: AnySidebarItem) => void
  onPermanentDelete: (item: AnySidebarItem) => void
  onClick: (item: AnySidebarItem) => void
  deletionTimeLabel: string
  visibleItemIds: Array<AnySidebarItem['_id']>
  canRestore: boolean
  canDeleteForever: boolean
}) {
  const Icon = getSidebarItemIcon(item)
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(item)
  const dragData = useSidebarDragData(item)
  const isDragging = useDndStore((state) => state.sidebarDragPreviewItemIds.includes(item._id))
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
        isDragging && 'opacity-50',
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
      <div className={sidebarItemActionGroupClass}>
        {canRestore && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'size-6 p-0 hover:bg-item-action-hover rounded-sm',
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
        )}
        {canDeleteForever && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'size-6 p-0 hover:text-destructive hover:bg-item-action-hover rounded-sm',
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
        )}
      </div>
    </div>
  )
}

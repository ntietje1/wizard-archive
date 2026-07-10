import { RotateCcw, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import {
  sidebarItemActionButtonClass,
  sidebarItemActionGroupClass,
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '../item-visual-state'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { TRASH_RETENTION_DAYS } from '../../items-persistence-contract'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment } from 'react'

interface TrashPopoverSurfaceItem {
  canDeleteForever?: boolean
  canRestore?: boolean
  deleteForeverPending?: boolean
  deletedLabel: string
  icon: LucideIcon
  id: string
  isDragging?: boolean
  name: string
  restorePending?: boolean
  selected?: boolean
}

interface TrashPopoverSurfaceProps {
  canEmptyTrash?: boolean
  emptyTrashPending?: boolean
  items: Array<TrashPopoverSurfaceItem>
  onDeleteForever?: (item: TrashPopoverSurfaceItem) => void
  onEmptyTrash?: () => void
  onItemClick?: (item: TrashPopoverSurfaceItem) => void
  onOpenFullPage: () => void
  onRestore?: (item: TrashPopoverSurfaceItem) => void
  openFullPagePending?: boolean
  renderItemWrapper?: (item: TrashPopoverSurfaceItem, row: ReactNode) => ReactNode
}

export function TrashPopoverSurface({
  canEmptyTrash = false,
  emptyTrashPending = false,
  items,
  onDeleteForever,
  onEmptyTrash,
  onItemClick,
  onOpenFullPage,
  onRestore,
  openFullPagePending = false,
  renderItemWrapper,
}: TrashPopoverSurfaceProps) {
  return (
    <div className="relative flex w-72 flex-col">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 size-6 text-muted-foreground"
        onClick={onOpenFullPage}
        title="Open full page"
        aria-label="Open full trash view"
        disabled={openFullPagePending}
        aria-busy={openFullPagePending || undefined}
      >
        <SquareArrowOutUpRight className="size-3.5" />
      </Button>

      <div className="px-2 pb-1.5">
        <span className="text-sm font-medium">Trash</span>
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="px-1">
          {items.map((item) => {
            const row = (
              <TrashPopoverSurfaceRow
                item={item}
                onClick={onItemClick}
                onDeleteForever={onDeleteForever}
                onRestore={onRestore}
              />
            )
            return <Fragment key={item.id}>{renderItemWrapper?.(item, row) ?? row}</Fragment>
          })}

          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              Trash is empty
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-1.5 flex items-center justify-between gap-2 border-t px-2 pt-1.5">
        <p className="text-[11px] leading-tight text-muted-foreground">
          Items older than {TRASH_RETENTION_DAYS} days are automatically deleted.
        </p>
        {canEmptyTrash && items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
            onClick={onEmptyTrash}
            disabled={emptyTrashPending}
            aria-busy={emptyTrashPending || undefined}
          >
            Empty Trash
          </Button>
        )}
      </div>
    </div>
  )
}

function TrashPopoverSurfaceRow({
  item,
  onClick,
  onDeleteForever,
  onRestore,
}: {
  item: TrashPopoverSurfaceItem
  onClick?: (item: TrashPopoverSurfaceItem) => void
  onDeleteForever?: (item: TrashPopoverSurfaceItem) => void
  onRestore?: (item: TrashPopoverSurfaceItem) => void
}) {
  const Icon = item.icon
  const visualState = {
    isSelected: item.selected === true,
    isViewing: item.selected === true,
    isMultiSelected: false,
  }

  return (
    <div
      data-testid={`trash-item-${item.id}`}
      className={cn(
        'flex w-full min-w-0 items-center rounded-sm px-1 py-1 group',
        item.isDragging && 'opacity-50',
        sidebarItemBackgroundClass(visualState),
      )}
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left"
        onClick={() => onClick?.(item)}
      >
        <div
          className={cn(
            'flex size-6 shrink-0 items-center justify-center',
            sidebarItemIconClass(visualState),
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('truncate text-sm', sidebarItemNameClass(visualState))}>
            {item.name}
          </div>
          <div className="truncate text-xs leading-none text-muted-foreground">
            Deleted {item.deletedLabel}
          </div>
        </div>
      </button>
      <div className={sidebarItemActionGroupClass}>
        {item.canRestore && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'size-6 rounded-sm p-0 hover:bg-item-action-hover',
              sidebarItemActionButtonClass(visualState),
            )}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRestore?.(item)
            }}
            aria-label="Restore"
            disabled={item.restorePending}
            aria-busy={item.restorePending || undefined}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        )}
        {item.canDeleteForever && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'size-6 rounded-sm p-0 hover:bg-item-action-hover hover:text-destructive',
              sidebarItemActionButtonClass(visualState),
            )}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDeleteForever?.(item)
            }}
            aria-label="Delete forever"
            disabled={item.deleteForeverPending}
            aria-busy={item.deleteForeverPending || undefined}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

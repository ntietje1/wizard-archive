import { useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { ClientOnly } from '@wizard-archive/ui/components/client-only'
import type { FolderItem } from '../../workspace/items'
import type { ResourceItemCardProps } from '../../filesystem/cards/shell'
import { CardTitle } from '@wizard-archive/ui/shadcn/components/card'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { useSidebarItemVisualState } from '../../workspace/sidebar/use-sidebar-item-visual-state'
import { useContextMenu } from '../../context-menu/hooks/use-context-menu'
import { WorkspaceContextMenu } from '../../workspace/context-menu/context-menu'
import { useDraggable } from '../../drag-drop/use-draggable'
import { useSidebarItemDropTarget } from '../../drag-drop/use-sidebar-item-drop-target'
import { useMergedRef } from '../../drag-drop/ref-utils'
import { useDndStore } from '../../drag-drop/store'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useItemSelectionInteractions } from '../../workspace/sidebar/use-item-selection-interactions'
import { useSidebarDragData } from '../../drag-drop/sidebar-drag-data'
import { folderItemFolderFillClass } from '../../filesystem/cards/visual-state'
import { sidebarItemNameClass } from '../../workspace/sidebar/item-visual-state'
import {
  dropTargetSvgFillClassName,
  dropTargetSvgStrokeClassName,
} from '@wizard-archive/ui/drag-drop/drop-target-visual-state'

const H = 140
const W = 400
const R = 4
const TAB_W = 80
const TAB_H = 12
const NOTCH_W = 12

const FOLDER_SHAPE = [
  `M 0,${TAB_H + R}`,
  `L 0,${R}`,
  `A ${R},${R} 0 0,1 ${R},0`,
  `L ${TAB_W},0`,
  `L ${TAB_W + NOTCH_W},${TAB_H}`,
  `L ${W - R},${TAB_H}`,
  `A ${R},${R} 0 0,1 ${W},${TAB_H + R}`,
  `L ${W},${H - R}`,
  `A ${R},${R} 0 0,1 ${W - R},${H}`,
  `L ${R},${H}`,
  `A ${R},${R} 0 0,1 0,${H - R}`,
  'Z',
].join(' ')

type DropState = 'none' | 'valid' | 'trash'
type FolderCardProps = ResourceItemCardProps<FolderItem>

function folderStrokeClass(dropState: DropState, { isSelected = false }: { isSelected?: boolean }) {
  if (dropState === 'trash') return dropTargetSvgStrokeClassName('destructive')
  if (dropState === 'valid') return dropTargetSvgStrokeClassName('default')
  if (isSelected) return 'stroke-item-selected-outline'
  return 'stroke-border'
}

function FolderSvg({
  dropState = 'none',
  isSelected = false,
  isViewing = false,
  isMultiSelected = false,
}: {
  dropState?: DropState
  isSelected?: boolean
  isViewing?: boolean
  isMultiSelected?: boolean
}) {
  const visualState = { isSelected, isViewing, isMultiSelected }
  const strokeClass = folderStrokeClass(dropState, visualState)
  const strokeWidth = 'stroke-[1.25px]'
  const tintClass =
    dropState === 'trash'
      ? dropTargetSvgFillClassName('destructive')
      : dropState === 'valid'
        ? dropTargetSvgFillClassName('default')
        : undefined
  const fillClass = folderItemFolderFillClass(visualState)

  return (
    <svg
      className={cn('absolute inset-0 w-full h-full overflow-visible')}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <path d={FOLDER_SHAPE} className={cn(fillClass, strokeWidth, strokeClass)} />
      {tintClass && <path d={FOLDER_SHAPE} className={cn(tintClass, 'stroke-none')} />}
    </svg>
  )
}

function FolderCardSkeleton() {
  return (
    <div className="h-[140px]">
      <div className="relative block w-full h-full">
        <FolderSvg />
        <div className="relative z-[2] pt-3 px-2">
          <div className="bg-muted rounded-md h-5 w-32" />
        </div>
      </div>
    </div>
  )
}

function FolderCardInner({
  item: folder,
  onClick,
  parentId,
  source,
  visibleItemIds,
  itemSurface = 'folder-view',
}: FolderCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const visualState = useSidebarItemVisualState(folder, source.currentItemId)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(folder, {
    surface: itemSurface,
    parentId: parentId ?? null,
    visibleItemIds: visibleItemIds ?? [folder.id],
  })
  const dragData = useSidebarDragData(folder, source)
  const isDragging = useDndStore((state) => state.dragPreviewItemIds.includes(folder.id))

  const canDrag = source.canDragItem(folder)

  const { draggableRef, isDraggingRef } = useDraggable({
    data: dragData,
    canDrag,
  })

  const { dropTargetRef, isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget(
    {
      ref,
      item: folder,
      canDrop: canDrag,
    },
  )
  const setFolderCardRef = useMergedRef(ref, draggableRef, dropTargetRef)

  const dropState: DropState =
    !isDropTarget && !isFileDropTarget ? 'none' : isDropTarget && isTrashAction ? 'trash' : 'valid'

  const cardContent = (
    <div
      ref={setFolderCardRef}
      className={cn('group/folder-card relative h-[140px]', isDragging && 'opacity-50')}
    >
      <button
        type="button"
        aria-label={folder.name}
        data-item-selection-target="true"
        className="group/folder-card block h-full w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        draggable={false}
        onContextMenu={handleItemContextMenu}
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            handleItemClick(e, onClick)
            return
          }
          handleItemClick(e, () => void source.openItem(folder.id))
        }}
      >
        <div className="relative block w-full h-full cursor-pointer group">
          <FolderSvg
            dropState={dropState}
            isSelected={visualState.isSelected}
            isViewing={visualState.isViewing}
            isMultiSelected={visualState.isMultiSelected}
          />

          <div className="relative z-[2] pt-3 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle
                className={cn(
                  'p-1 text-sm font-medium truncate select-none flex-1 min-w-0',
                  sidebarItemNameClass(visualState),
                )}
              >
                {folder.name}
              </CardTitle>
            </div>
          </div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-[18px] right-2 size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-item-action-hover rounded-sm opacity-0 group-hover/folder-card:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring transition-opacity z-10"
        aria-label="Open folder menu"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleItemContextMenu(e)
          handleMoreOptions(e)
        }}
      >
        <MoreVertical className="size-4" />
      </Button>
    </div>
  )

  return (
    <WorkspaceContextMenu
      ref={contextMenuRef}
      viewContext={itemSurface === 'trash' ? 'trash-view' : 'folder-view'}
      item={folder}
    >
      {cardContent}
    </WorkspaceContextMenu>
  )
}

export function FolderCard(props: FolderCardProps) {
  if (props.isLoading) {
    return <FolderCardSkeleton />
  }

  return (
    <ClientOnly fallback={<FolderCardSkeleton />}>
      <FolderCardInner {...props} />
    </ClientOnly>
  )
}

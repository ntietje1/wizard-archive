import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import { MoreVertical } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/features/dnd/utils/dnd-registry'
import { CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import {
  sidebarItemFolderFillClass,
  sidebarItemHoverFillClass,
  sidebarItemHoverOverlayClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'

const H = 140
const R = 4
const TAB_W = 80
const TAB_H = 12
const NOTCH_W = 12

/** Tab + notch fill */
const TAB_FILL = [
  `M ${R},0`,
  `L ${TAB_W},0`,
  `L ${TAB_W + NOTCH_W},${TAB_H}`,
  `L ${TAB_W + NOTCH_W},${TAB_H + 1}`,
  `L ${R},${TAB_H + 1}`,
  `L ${R},${TAB_H + R}`,
  `L 0,${TAB_H + R}`,
  `L 0,${R}`,
  `A ${R},${R} 0 0,1 ${R},0`,
  'Z',
].join(' ')

/** Tab + notch outline */
const TAB_STROKE = [
  `M 0,${TAB_H + R}`,
  `L 0,${R}`,
  `A ${R},${R} 0 0,1 ${R},0`,
  `L ${TAB_W},0`,
  `L ${TAB_W + NOTCH_W},${TAB_H}`,
].join(' ')

type DropState = 'none' | 'valid' | 'trash'

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
  const isDrop = dropState !== 'none'
  const strokeClass =
    dropState === 'trash'
      ? 'stroke-destructive'
      : dropState === 'valid'
        ? 'stroke-ring'
        : 'stroke-border'
  const strokeWidth = isDrop ? 'stroke-[3]' : 'stroke-2'
  const tintClass =
    dropState === 'trash' ? 'fill-destructive/5' : dropState === 'valid' ? 'fill-ring/5' : undefined
  const visualState = { isSelected, isViewing, isMultiSelected }
  const fillClass = sidebarItemFolderFillClass(visualState)
  const hoverFillClass = sidebarItemHoverFillClass(visualState)
  const hoverOverlayClass = sidebarItemHoverOverlayClass(visualState)

  return (
    <svg className={cn('absolute inset-0 w-full h-full overflow-visible')}>
      <rect
        y={TAB_H}
        width="100%"
        height={H - TAB_H}
        rx={R}
        className={cn(fillClass, '[paint-order:stroke]', strokeWidth, strokeClass)}
      />
      <path d={TAB_STROKE} className={cn('fill-none', strokeWidth, strokeClass)} />
      <path d={TAB_FILL} className={fillClass} />
      {tintClass && (
        <>
          <rect
            y={TAB_H + 1}
            width="100%"
            height={H - TAB_H - 1}
            rx={R}
            className={cn(tintClass, 'stroke-none')}
          />
          <path d={TAB_FILL} className={tintClass} />
        </>
      )}
      {/* Hover fill — clipped to folder shape */}
      <rect
        y={TAB_H + 1}
        width="100%"
        height={H - TAB_H - 1}
        rx={R}
        className={cn(hoverFillClass, 'stroke-none', hoverOverlayClass)}
      />
      <path d={TAB_FILL} className={cn(hoverFillClass, hoverOverlayClass)} />
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
  visibleItemIds,
  itemSurface = 'folder-view',
}: ItemCardProps<Folder>) {
  const ref = useRef<HTMLDivElement>(null)
  const linkProps = useEditorLinkProps(folder)
  const { setLastSelectedItem } = useLastEditorItem()
  const visualState = useSidebarItemVisualState(folder)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(folder, {
    surface: itemSurface,
    parentId: parentId ?? null,
    visibleItemIds: visibleItemIds ?? [folder._id],
  })
  const dragData = useSidebarDragData(folder)

  const isDropTarget = useDndStore((s) => s.sidebarDragTargetId === folder._id)
  const isTrashAction = useDndStore(
    (s) => s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )

  const canDrag = hasAtLeastPermissionLevel(folder.myPermissionLevel, PERMISSION_LEVEL.FULL_ACCESS)

  const { isDraggingRef } = useDraggable({
    ref,
    data: dragData,
    canDrag,
    dragOpacity: '0.2',
  })

  useSidebarItemDropTarget({ ref, item: folder })

  useExternalDropTarget({
    ref,
    parentId: folder._id,
    canAcceptFiles: canDropFilesOnTarget(folder),
  })

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const fileDragHoveredId = useDndStore((s) => s.fileDragHoveredId)
  const isFileDragTarget = isDraggingFiles && fileDragHoveredId === folder._id

  const dropState: DropState =
    !isDropTarget && !isFileDragTarget ? 'none' : isDropTarget && isTrashAction ? 'trash' : 'valid'

  const cardContent = (
    <div ref={ref} className="h-[140px]">
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        aria-label={folder.name}
        data-item-selection-target="true"
        className="block h-full [&.active]:pointer-events-auto"
        draggable={false}
        onContextMenu={handleItemContextMenu}
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
            return
          }
          if (onClick) {
            e.preventDefault()
            handleItemClick(e)
            onClick()
            return
          }
          handleItemClick(e, () => setLastSelectedItem(folder.slug))
        }}
      >
        <div className={cn('relative block w-full h-full cursor-pointer group rounded-md')}>
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

          <Button
            variant="ghost"
            size="sm"
            className="absolute top-[18px] right-2 size-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
      </Link>
    </div>
  )

  return (
    <EditorContextMenu ref={contextMenuRef} viewContext="folder-view" item={folder}>
      {cardContent}
    </EditorContextMenu>
  )
}

export function FolderCard(props: ItemCardProps<Folder>) {
  if (props.isLoading) {
    return <FolderCardSkeleton />
  }

  return (
    <ClientOnly fallback={<FolderCardSkeleton />}>
      <FolderCardInner {...props} />
    </ClientOnly>
  )
}

import { useRef } from 'react'
import { ClientOnly, Link } from '@tanstack/react-router'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { MoreVertical } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import type { Folder } from 'shared/folders/types'
import { CardTitle } from '~/features/shadcn/components/card'
import { Button } from '~/features/shadcn/components/button'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useDraggable } from '~/features/dnd/hooks/useDraggable'
import { useSidebarItemDropTarget } from '~/features/dnd/hooks/useSidebarItemDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { cn } from '~/features/shadcn/lib/utils'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { folderItemFolderFillClass } from './folder-item-visual-state'
import { sidebarItemNameClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { useCampaignActorPermissions } from '~/features/campaigns/hooks/useCampaignActorPermissions'

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

function folderStrokeClass(dropState: DropState, { isSelected = false }: { isSelected?: boolean }) {
  if (dropState === 'trash') return 'stroke-destructive'
  if (dropState === 'valid') return 'stroke-ring'
  if (isSelected) return 'stroke-primary/70 dark:stroke-primary/80'
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
    dropState === 'trash' ? 'fill-destructive/5' : dropState === 'valid' ? 'fill-ring/5' : undefined
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
  const isDragging = useDndStore((state) => state.sidebarDragPreviewItemIds.includes(folder._id))
  const actorPermissions = useCampaignActorPermissions()

  const canDrag = actorPermissions.canMutate(folder, PERMISSION_LEVEL.FULL_ACCESS)

  const { isDraggingRef } = useDraggable({
    ref,
    data: dragData,
    canDrag,
  })

  const { isDropTarget, isTrashAction, isFileDropTarget } = useSidebarItemDropTarget({
    ref,
    item: folder,
    canDrop: canDrag,
  })

  const dropState: DropState =
    !isDropTarget && !isFileDropTarget ? 'none' : isDropTarget && isTrashAction ? 'trash' : 'valid'

  const cardContent = (
    <div ref={ref} className={cn('h-[140px]', isDragging && 'opacity-50')}>
      <Link
        {...linkProps}
        activeOptions={{ includeSearch: false }}
        aria-label={folder.name}
        aria-selected={visualState.isSelected}
        data-item-selection-target="true"
        className="group/folder-card block h-full outline-none [&.active]:pointer-events-auto"
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
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext={itemSurface === 'trash' ? 'trash-view' : 'folder-view'}
      item={folder}
    >
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

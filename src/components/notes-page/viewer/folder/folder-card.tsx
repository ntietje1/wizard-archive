import { ClientOnly } from '@tanstack/react-router'
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { ItemCardProps } from './item-card'
import type { Folder } from 'convex/folders/types'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { canDropFilesOnTarget, canDropItem } from '~/lib/dnd-utils'
import { CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { MoreVertical } from '~/lib/icons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useContextMenu } from '~/hooks/useContextMenu'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useFileDragDrop } from '~/hooks/useFileDragDrop'
import { useFileSidebar } from '~/hooks/useFileSidebar'

function FolderSvg() {
  return (
    <div className="folder flex h-full relative text-white">
      {/* Left section */}
      <div className="folder-left shrink-0 w-[120px] -mr-px">
        <svg viewBox="0 0 120 200" preserveAspectRatio="none" className="w-full h-full block">
          <path
            d="M 100,15 L 85,0 L 10,0 C 5,0 0,5 0,15 L 0,185 C 0,195 5,200 10,200 L 120,200 L 120,15 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Middle section */}
      <div className="folder-middle grow min-w-[20px] -mr-px">
        <svg viewBox="0 0 20 200" preserveAspectRatio="none" className="w-full h-full block">
          <rect x="0" y="15" width="20" height="200" fill="currentColor" />
        </svg>
      </div>

      {/* Right section*/}
      <div className="folder-right shrink-0 w-[60px]">
        <svg viewBox="0 0 60 200" preserveAspectRatio="none" className="w-full h-full block">
          <path
            d="M 0,15 L 50,15 C 55,15 59,17 60,25 L 60,185 C 60,195 57,200 50,200 L 0,200 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Background (hides seams) */}
      <div className="folder-seam-cover absolute top-[11.5px] left-5 right-5 bottom-[1.5px] bg-white pointer-events-none z-[1]"></div>
    </div>
  )
}

function FolderCardSkeleton() {
  return (
    <div className="h-[140px]">
      <div className="folder-wrapper">
        <FolderSvg />
        <div className="folder-content px-2">
          <div className="flex items-center gap-2 mb-2 min-w-0 py-0">
            <div className="pt-2">
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FolderCardInner({
  item: folder,
  onClick,
  parentId,
}: ItemCardProps<Folder>) {
  const { active, over } = useDndContext()
  const { navigateToFolder } = useEditorNavigation()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { activeDragItem, fileDragHoveredId, isDraggingFiles } =
    useFileSidebar()

  // Include parentId in ancestorIds for circular drop prevention
  const ancestorIds = parentId ? [parentId] : []
  const dropData: SidebarDropData = { ...folder, ancestorIds }
  const dragData: SidebarDragData = { ...folder, ancestorIds }

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder._id,
    data: dropData,
    disabled: activeDragItem?._id === folder._id,
  })

  const canDrop = canDropItem(active, over)
  const isValidDropTarget = canDrop && isOver

  // Handle native file drag-and-drop
  const canAcceptFileDrops = canDropFilesOnTarget(dropData)
  const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } =
    useFileDragDrop(canAcceptFileDrops ? folder._id : undefined)
  const isFileValidDrop =
    isDraggingFiles && canAcceptFileDrops && fileDragHoveredId === folder._id

  const shouldHighlight = isValidDropTarget || isFileValidDrop

  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: folder._id,
    data: dragData,
  })

  const handleCardActivate = () => {
    if (!isDragging && onClick) {
      onClick()
    } else {
      navigateToFolder(folder.slug)
    }
  }

  const cardContent = (
    <div
      ref={(el) => {
        setDropRef(el)
        setDragRef(el)
      }}
      {...listeners}
      {...attributes}
      className={`h-[140px] ${isDragging ? 'opacity-20' : ''}`}
      onDragEnter={canAcceptFileDrops ? handleDragEnter : undefined}
      onDragOver={canAcceptFileDrops ? handleDragOver : undefined}
      onDragLeave={canAcceptFileDrops ? handleDragLeave : undefined}
      onDrop={canAcceptFileDrops ? handleDrop : undefined}
    >
      <div
        className={`folder-wrapper group transition-all relative ${
          shouldHighlight ? 'valid-drop-target' : ''
        }`}
        onClick={handleCardActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCardActivate()
          }
        }}
        tabIndex={0}
        role="button"
      >
        <FolderSvg />

        <div className="folder-content px-2">
          <div className="flex items-center gap-2 mb-2 min-w-0 py-0">
            <CardTitle className="p-1 text-sm font-medium text-slate-800 truncate select-none flex-1 min-w-0">
              {folder.name || defaultItemName(folder)}
            </CardTitle>
          </div>
        </div>

        {/* Three-dot menu button in top right */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-5 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
          aria-label="Open folder menu"
          onClick={(e) => {
            e.stopPropagation()
            handleMoreOptions(e)
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <EditorContextMenu
      ref={contextMenuRef}
      viewContext="folder-view"
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

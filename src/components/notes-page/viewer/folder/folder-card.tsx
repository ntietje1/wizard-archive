import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { ItemCardProps } from './item-card'
import type { Folder } from 'convex/folders/types'
import type { SidebarDragData, SidebarDropData } from '~/lib/dnd-utils'
import { canDropItem } from '~/lib/dnd-utils'
import { CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Button } from '~/components/shadcn/ui/button'
import { Folder as FolderIcon, MoreVertical } from '~/lib/icons'
import { FolderViewContextMenu } from '~/components/context-menu/folder-view/FolderViewContextMenu'
import '~/components/notes-page/viewer/folder/folder-card.css'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useContextMenu } from '~/hooks/useContextMenu'

function FolderSvg() {
  return (
    <div className="folder">
      {/* Left section */}
      <div className="folder-left">
        <svg viewBox="0 0 120 200" preserveAspectRatio="none">
          <path
            d="M 100,15 L 85,0 L 10,0 C 5,0 0,5 0,15 L 0,185 C 0,195 5,200 10,200 L 120,200 L 120,15 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Middle section */}
      <div className="folder-middle">
        <svg viewBox="0 0 20 200" preserveAspectRatio="none">
          <rect x="0" y="15" width="20" height="200" fill="currentColor" />
        </svg>
      </div>

      {/* Right section*/}
      <div className="folder-right">
        <svg viewBox="0 0 60 200" preserveAspectRatio="none">
          <path
            d="M 0,15 L 50,15 C 55,15 59,17 60,25 L 60,185 C 60,195 57,200 50,200 L 0,200 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Background (hides seams) */}
      <div className="folder-seam-cover"></div>
    </div>
  )
}

export function FolderCard({
  item: folder,
  onClick,
  isLoading,
}: ItemCardProps<Folder>) {
  const { active, over } = useDndContext()
  const { navigateToFolder } = useEditorNavigation()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()

  const dropData: SidebarDropData = {
    _id: folder._id,
    type: SIDEBAR_ITEM_TYPES.folders,
  }
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder._id,
    data: dropData,
  })

  const isValidDropTarget =
    isOver && active && over && canDropItem(active, over)

  const dragData: SidebarDragData = {
    _id: folder._id,
    type: SIDEBAR_ITEM_TYPES.folders,
    name: folder.name || defaultItemName(folder),
    parentId: folder.parentId,
    icon: FolderIcon,
  }
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

  if (isLoading) {
    return (
      <div className="h-[140px]">
        <div className="folder-wrapper">
          <FolderSvg />
          <div className="folder-content p-3">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </div>
    )
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
    >
      <div
        className={`folder-wrapper group transition-all relative ${
          isValidDropTarget ? 'valid-drop-target' : ''
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
    <FolderViewContextMenu ref={contextMenuRef} item={folder}>
      {cardContent}
    </FolderViewContextMenu>
  )
}

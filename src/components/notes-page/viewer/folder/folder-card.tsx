import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core'
import {
  type SidebarDragData,
  type SidebarDropData,
  canDropItem,
} from '~/lib/dnd-utils'
import { CardTitle } from '~/components/shadcn/ui/card'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { Folder as FolderIcon } from '~/lib/icons'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import type { ItemCardProps } from './item-card'
import '~/components/notes-page/viewer/folder/folder-card.css'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { Folder } from 'convex/folders/types'

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
  category,
  onClick,
  isLoading,
}: ItemCardProps<Folder>) {
  const { active, over } = useDndContext()
  const { navigateToFolder } = useEditorNavigation()

  const categoryId = folder.categoryId
  const dropData: SidebarDropData = {
    _id: folder._id,
    type: SIDEBAR_ITEM_TYPES.folders,
    categoryId,
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
    categoryId,
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

  if (isLoading || !folder) {
    return (
      <div className="h-[140px]">
        <div className="folder-wrapper">
          <FolderSvg />
          <div className="folder-content p-3">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-6 w-32" />
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
        className={`folder-wrapper group transition-all ${
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

        <div className="folder-content p-3">
          <div className="flex items-center gap-2 min-w-0">
            <FolderIcon className="w-6 h-6 text-amber-600 select-none flex-shrink-0" />
            <CardTitle className="text-xl text-slate-800 truncate select-none">
              {folder.name || defaultItemName(folder)}
            </CardTitle>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <SidebarItemContextMenu
      item={folder}
      viewContext="folder-view"
      category={category}
    >
      {cardContent}
    </SidebarItemContextMenu>
  )
}

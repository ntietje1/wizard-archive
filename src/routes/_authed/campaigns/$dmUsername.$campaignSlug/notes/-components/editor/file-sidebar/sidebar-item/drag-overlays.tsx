import {
  SIDEBAR_ITEM_TYPES,
  UNTITLED_FOLDER_NAME,
  UNTITLED_NOTE_TITLE,
} from 'convex/notes/types'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { Folder as FolderIcon, FileText } from '~/lib/icons'
import type { SidebarDragData } from '../dnd-utils'

export function DragOverlayItem({ item }: { item: SidebarDragData }) {
  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const icon = isFolder ? FolderIcon : FileText
  const defaultName = isFolder ? UNTITLED_FOLDER_NAME : UNTITLED_NOTE_TITLE

  return (
    <div className="bg-muted/50 shadow-lg rounded-sm scale-95">
      <SidebarItemButtonBase
        icon={icon}
        name={item.name}
        defaultName={defaultName}
        isSelected={false}
        isRenaming={false}
        showChevron={isFolder}
      />
    </div>
  )
}

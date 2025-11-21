import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { Folder as FolderIcon, FileText, MapPin } from '~/lib/icons'
import type { SidebarDragData } from '../dnd-utils'
import { useMemo } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { File } from 'lucide-react'

export function DragOverlayItem({ item }: { item: SidebarDragData }) {
  const icon = useMemo(() => {
    switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      return FolderIcon
    case SIDEBAR_ITEM_TYPES.notes:
      return FileText
    case SIDEBAR_ITEM_TYPES.maps:
      return MapPin
    default:
      return File
    }
  }, [item.type])

  return (
    <div className="bg-muted/50 shadow-lg rounded-sm scale-95">
      <SidebarItemButtonBase
        icon={icon}
        name={item.name}
        defaultName={item.name}
        isSelected={false}
        isRenaming={false}
        showChevron={false}
      />
    </div>
  )
}

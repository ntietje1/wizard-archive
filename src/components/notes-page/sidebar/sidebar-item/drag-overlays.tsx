import { SidebarItemButtonBase } from './sidebar-item-button-base'
import type { SidebarDragData } from '~/components/notes-page/sidebar/dnd-utils'

export function DragOverlayItem({ item }: { item: SidebarDragData }) {
  return (
    <div className="bg-muted/50 shadow-lg rounded-sm scale-95">
      <SidebarItemButtonBase
        icon={item.icon}
        name={item.name}
        defaultName={item.name}
        isSelected={false}
        isRenaming={false}
        showChevron={false}
      />
    </div>
  )
}

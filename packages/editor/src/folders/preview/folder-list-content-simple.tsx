import { getSidebarItemIcon } from '../../workspace/sidebar/item-icons'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import type { AnyItem } from '../../workspace/items'

export function FolderListContentSimple({ items }: { items: Array<AnyItem> }) {
  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Empty folder
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <ul aria-label="Folder contents" className="p-2 space-y-0.5">
        {items.map((child) => {
          const Icon = getSidebarItemIcon(child)
          return (
            <li key={child.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{child.name}</span>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}

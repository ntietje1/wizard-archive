import type { Id } from 'convex/_generated/dataModel'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function FolderListContentSimple({ folderId }: { folderId: Id<'sidebarItems'> }) {
  const { parentItemsMap } = useActiveSidebarItems()
  const children = parentItemsMap.get(folderId) ?? []

  if (children.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Empty folder
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <ul aria-label="Folder contents" className="p-2 space-y-0.5">
        {children.map((child) => {
          const Icon = getSidebarItemIcon(child)
          return (
            <li key={child._id} className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{child.name}</span>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}

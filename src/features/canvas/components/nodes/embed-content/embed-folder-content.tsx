import type { Id } from 'convex/_generated/dataModel'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'

export function EmbedFolderContent({ folderId }: { folderId: Id<'sidebarItems'> }) {
  const { parentItemsMap } = useActiveSidebarItems()
  const children = parentItemsMap.get(folderId) ?? []

  if (children.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-xs text-muted-foreground">
        Empty folder
      </div>
    )
  }

  return (
    <ul
      aria-label="Folder contents"
      className="nodrag nopan nowheel h-full overflow-auto p-2 space-y-0.5"
    >
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
  )
}

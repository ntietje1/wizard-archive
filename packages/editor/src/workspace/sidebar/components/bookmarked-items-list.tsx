import { useSidebarWorkspaceState } from '../workspace-state'
import { SidebarItemButton } from './sidebar-item/sidebar-item-button'
import { SidebarLoadingSkeleton } from './sidebar-loading-skeleton'
import { SidebarSurfaceScrollArea } from './sidebar-surface-scroll-area'
import type { SidebarTreeSource } from './sidebar-tree-source'

export function BookmarkedItemsList({ source }: { source: SidebarTreeSource }) {
  const {
    editing: { renamingItemId, setRenamingItemId },
    sort: { options: sortOptions },
  } = useSidebarWorkspaceState()
  const isActive = source.activeStatus === 'success'

  const bookmarkedItems = isActive ? source.getBookmarkedItems({ sortOptions }) : []
  const visibleItemIds = bookmarkedItems.map((item) => item.id)

  if (!isActive) {
    return <BookmarkedItemsLoading />
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      <SidebarSurfaceScrollArea surface="bookmarks" parentId={null} visibleItemIds={visibleItemIds}>
        <div className="p-1 min-w-0 w-full max-w-full">
          {bookmarkedItems.map((item) => (
            <SidebarItemButton
              expanded={false}
              key={item.id}
              item={item}
              renamingId={renamingItemId}
              setRenamingId={setRenamingItemId}
              showChevron={false}
              source={source.item}
              surface="bookmarks"
              visibleItemIds={visibleItemIds}
            />
          ))}

          {bookmarkedItems.length === 0 && (
            <div className="flex flex-col gap-2 mx-8 my-4 text-muted-foreground items-center text-sm text-center">
              No bookmarked items
            </div>
          )}
        </div>
      </SidebarSurfaceScrollArea>
    </div>
  )
}

function BookmarkedItemsLoading() {
  return <SidebarLoadingSkeleton rows={['w-3/4', 'w-1/2', 'w-5/6']} />
}

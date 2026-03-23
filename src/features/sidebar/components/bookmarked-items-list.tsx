import { useMemo } from 'react'
import { FlatSidebarItem } from './sidebar-item/flat-sidebar-item'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import {
  sortItemsByOptions,
  useFilteredSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

export function BookmarkedItemsList() {
  const { data: filteredItems, status } = useFilteredSidebarItems()
  const { sortOptions } = useSortOptions()
  const renamingId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)

  const bookmarkedItems = useMemo(() => {
    const bookmarked = filteredItems.filter(
      (item) => item.isBookmarked === true,
    )
    return sortItemsByOptions(sortOptions, bookmarked) ?? []
  }, [filteredItems, sortOptions])

  if (status !== 'success') {
    return <BookmarkedItemsLoading />
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 min-w-0 w-full">
        <div className="p-1 min-w-0 w-full max-w-full">
          {bookmarkedItems?.map((item) => (
            <FlatSidebarItem
              key={item._id}
              item={item}
              isExpanded={false}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))}

          {bookmarkedItems && bookmarkedItems.length === 0 && (
            <div className="flex flex-col gap-2 mx-8 my-4 text-muted-foreground items-center text-sm text-center">
              No bookmarked items
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function BookmarkedItemsLoading() {
  return (
    <div className="flex-1 p-2">
      <div className="space-y-2">
        <div className="bg-muted rounded-md h-4 w-3/4" />
        <div className="bg-muted rounded-md h-4 w-1/2" />
        <div className="bg-muted rounded-md h-4 w-5/6" />
      </div>
    </div>
  )
}

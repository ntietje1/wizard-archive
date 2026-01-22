import { useMemo } from 'react'
import { SidebarItem } from './sidebar-item/sidebar-item'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { sortItemsByOptions, useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'

export function BookmarkedItemsList() {
  const allItems = useAllSidebarItems()
  const { sortOptions } = useSortOptions()

  const bookmarkedItems = useMemo(() => {
    const filtered = allItems.data?.filter((item) => item.isBookmarked) ?? []
    return sortItemsByOptions(sortOptions, filtered)
  }, [allItems.data, sortOptions])

  if (allItems.status === 'pending') {
    return <BookmarkedItemsLoading />
  }

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 min-w-0 w-full">
        <div className="p-1 min-w-0 w-full max-w-full">
          {bookmarkedItems?.map((item) => (
            <SidebarItem key={item._id} item={item} />
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
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

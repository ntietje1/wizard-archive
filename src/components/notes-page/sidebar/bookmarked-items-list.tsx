import { useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { FlatSidebarItem } from './sidebar-item/flat-sidebar-item'
import type { Id } from 'convex/_generated/dataModel'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { sortItemsByOptions } from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useSidebarItemsCollection } from '~/contexts/SidebarItemsCollectionContext'

const EMPTY_ANCESTORS: Array<Id<'folders'>> = []

export function BookmarkedItemsList() {
  const collection = useSidebarItemsCollection()
  const { sortOptions } = useSortOptions()
  const { renamingId, setRenamingId, activeDragItem } = useFileSidebar()

  const rawBookmarked = useLiveQuery(
    (q) => {
      if (!collection) return undefined
      return q
        .from({ item: collection })
        .fn.where((row) => row.item.isBookmarked === true)
    },
    [collection],
  )

  const bookmarkedItems = useMemo(() => {
    return sortItemsByOptions(sortOptions, rawBookmarked?.data) ?? []
  }, [rawBookmarked?.data, sortOptions])

  if (!collection) {
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
              ancestorIds={EMPTY_ANCESTORS}
              isExpanded={false}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              activeDragItem={activeDragItem}
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
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

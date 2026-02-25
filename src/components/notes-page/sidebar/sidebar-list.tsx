import { useMemo } from 'react'
import { SidebarItem } from './sidebar-item/sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import {
  sortItemsByOptions,
  useFilteredSidebarItems,
} from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function SidebarList() {
  const { parentItemsMap, status } = useFilteredSidebarItems()
  const { sortOptions } = useSortOptions()

  const rootItems: Array<AnySidebarItem> = useMemo(() => {
    return sortItemsByOptions(sortOptions, parentItemsMap.get(undefined)) ?? []
  }, [parentItemsMap, sortOptions])

  if (status !== 'success') {
    return null
  }

  return (
    <ScrollArea className="flex-1 min-h-0 min-w-0 w-full p-1">
      {rootItems.map((item) => (
        <SidebarItem
          key={item._id}
          item={item}
          parentItemsMap={parentItemsMap}
        />
      ))}
    </ScrollArea>
  )
}

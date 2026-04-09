import { SidebarItem } from './sidebar-item/sidebar-item'
import {
  sortItemsByOptions,
  useFilteredSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'

export function SidebarList() {
  const { parentItemsMap, status } = useFilteredSidebarItems()
  const { sortOptions } = useSortOptions()

  const rootItems = sortItemsByOptions(sortOptions, parentItemsMap.get(null)) ?? []

  if (status !== 'success') {
    return null
  }

  return (
    <ScrollArea className="flex-1 min-h-0 min-w-0 w-full p-1">
      {rootItems.map((item) => (
        <SidebarItem key={item._id} item={item} parentItemsMap={parentItemsMap} />
      ))}
    </ScrollArea>
  )
}
